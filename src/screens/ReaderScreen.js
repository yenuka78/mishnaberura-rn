import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState, View, TouchableOpacity, Text, StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FONT_KEY, saveLastPosition, saveRecentPosition,
} from '../readerState';

const DEFAULT_FONT = 16;
const MIN_FONT = 10;
const MAX_FONT = 28;

function buildAssetUri(file, anchor = '') {
  return `file:///android_asset/${file}${anchor ? `#${anchor}` : ''}`;
}

function getScalePercent(fontSize, multiplier = 1) {
  return Math.round((fontSize * multiplier * 100) / DEFAULT_FONT);
}

function buildScaleInjection(fontSize, multiplier = 1) {
  const percent = getScalePercent(fontSize, multiplier);
  return `
    (function() {
      var id = 'rn-font-scale-style';
      var style = document.getElementById(id);
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = 'html { -webkit-text-size-adjust: ${percent}% !important; text-size-adjust: ${percent}% !important; }';
    })();
    true;
  `;
}

function buildLinkInterceptor() {
  return `
    (function() {
      if (window.__rnLinkInterceptorInstalled) return;
      window.__rnLinkInterceptorInstalled = true;
      var lastSnippet = '';
      var snippetTimer = null;

      function normalizeSnippet(text) {
        return (text || '')
          .replace(/\\s+/g, ' ')
          .trim()
          .slice(0, 180);
      }

      function collectSnippet() {
        var probeX = Math.max(24, window.innerWidth * 0.5);
        var probeYs = [0.22, 0.38, 0.54, 0.7].map(function(ratio) {
          return Math.min(
            Math.max(60, window.innerHeight * ratio),
            Math.max(60, window.innerHeight - 40)
          );
        });
        var snippets = [];
        var seen = {};

        for (var i = 0; i < probeYs.length; i += 1) {
          var node = document.elementFromPoint(probeX, probeYs[i]);

          while (node && node !== document.body) {
            var text = normalizeSnippet(node.innerText || node.textContent);
            if (text.length >= 20) {
              if (!seen[text]) {
                snippets.push(text);
                seen[text] = true;
              }
              break;
            }
            node = node.parentElement;
          }
        }

        if (snippets.length > 0) {
          return normalizeSnippet(snippets.join(' | '));
        }

        return normalizeSnippet(document.body && document.body.innerText);
      }

      function sendViewportContext() {
        var snippet = collectSnippet();
        if (!snippet || snippet === lastSnippet) return;
        lastSnippet = snippet;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'viewport-context',
          snippet: snippet
        }));
      }

      function scheduleViewportContext() {
        if (snippetTimer) clearTimeout(snippetTimer);
        snippetTimer = setTimeout(sendViewportContext, 120);
      }

      document.addEventListener('click', function(event) {
        var node = event.target;
        while (node && node.tagName !== 'A') {
          node = node.parentElement;
        }
        if (!node) return;

        var hrefAttr = node.getAttribute('href') || '';
        if (!/_sh_(mishna|beur)\\.html/i.test(hrefAttr)) {
          return;
        }

        event.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'commentary-link',
          href: node.href,
          rawHref: hrefAttr
        }));
      }, true);

      window.addEventListener('scroll', scheduleViewportContext, { passive: true });
      window.addEventListener('load', scheduleViewportContext);
      window.addEventListener('resize', scheduleViewportContext);
      setTimeout(sendViewportContext, 150);
    })();
    true;
  `;
}

function parseCommentaryTarget(href, routeParams) {
  const parsed = new URL(href);
  const pathParts = parsed.pathname.split('/');
  const file = pathParts[pathParts.length - 1] || routeParams.mishnaFile;
  const anchor = parsed.hash ? parsed.hash.slice(1) : '';
  const tab = file.includes('_beur') ? 'beur' : 'mishna';

  return { file, anchor, tab };
}

function buildScrollRestoreInjection(scrollY) {
  return `
    (function() {
      window.requestAnimationFrame(function() {
        window.scrollTo(0, ${Math.max(0, Math.round(scrollY))});
      });
    })();
    true;
  `;
}

function buildRelativeScrollRestoreInjection(scrollRatio) {
  const normalizedRatio = Math.max(0, Math.min(1, scrollRatio));
  return `
    (function() {
      function restore() {
        var root = document.documentElement;
        var body = document.body;
        var docHeight = Math.max(
          root ? root.scrollHeight : 0,
          body ? body.scrollHeight : 0
        );
        var viewport = window.innerHeight || 0;
        var maxScroll = Math.max(0, docHeight - viewport);
        window.scrollTo(0, maxScroll * ${normalizedRatio});
      }

      window.requestAnimationFrame(function() {
        restore();
        setTimeout(restore, 80);
        setTimeout(restore, 200);
      });
    })();
    true;
  `;
}

export default function ReaderScreen({ route }) {
  const {
    file, mishnaFile, beurFile, anchor,
  } = route.params;

  const topWebViewRef = useRef(null);
  const bottomWebViewRefs = useRef({
    mishna: null,
    beur: null,
  });
  const scrollYRef = useRef(route.params.scrollY ?? 0);
  const scrollRatioRef = useRef(route.params.scrollRatio ?? 0);
  const historySnippetRef = useRef(route.params.historySnippet ?? route.params.simanTitle);
  const initialScrollYRef = useRef(route.params.scrollY ?? 0);
  const restoreScrollPendingRef = useRef((route.params.scrollY ?? 0) > 0);
  const lastSavedScrollYRef = useRef(route.params.scrollY ?? 0);

  const [bottomTab, setBottomTab] = useState(route.params.bottomTab ?? 'mishna');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [bottomTargets, setBottomTargets] = useState({
    mishna: {
      file:
        route.params.bottomTab === 'mishna' && route.params.bottomFile
          ? route.params.bottomFile
          : mishnaFile,
      anchor:
        route.params.bottomTab === 'mishna' ? (route.params.bottomAnchor ?? '') : '',
    },
    beur: {
      file:
        route.params.bottomTab === 'beur' && route.params.bottomFile
          ? route.params.bottomFile
          : beurFile,
      anchor:
        route.params.bottomTab === 'beur' ? (route.params.bottomAnchor ?? '') : '',
    },
  });

  const topUri = useMemo(() => buildAssetUri(file, anchor), [file, anchor]);
  const bottomUris = useMemo(
    () => ({
      mishna: buildAssetUri(bottomTargets.mishna.file, bottomTargets.mishna.anchor),
      beur: buildAssetUri(bottomTargets.beur.file, bottomTargets.beur.anchor),
    }),
    [bottomTargets]
  );

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(FONT_KEY).then(val => {
      if (!active || !val) return;
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed)) {
        setFontSize(parsed);
      }
    });

    scrollYRef.current = route.params.scrollY ?? 0;
    scrollRatioRef.current = route.params.scrollRatio ?? 0;
    historySnippetRef.current = route.params.historySnippet ?? route.params.simanTitle;
    initialScrollYRef.current = route.params.scrollY ?? 0;
    restoreScrollPendingRef.current = (route.params.scrollY ?? 0) > 0;
    lastSavedScrollYRef.current = route.params.scrollY ?? 0;
    setBottomTab(route.params.bottomTab ?? 'mishna');
    setBottomTargets({
      mishna: {
        file:
          route.params.bottomTab === 'mishna' && route.params.bottomFile
            ? route.params.bottomFile
            : mishnaFile,
        anchor:
          route.params.bottomTab === 'mishna' ? (route.params.bottomAnchor ?? '') : '',
      },
      beur: {
        file:
          route.params.bottomTab === 'beur' && route.params.bottomFile
            ? route.params.bottomFile
            : beurFile,
        anchor:
          route.params.bottomTab === 'beur' ? (route.params.bottomAnchor ?? '') : '',
      },
    });

    return () => {
      active = false;
    };
  }, [route.params, mishnaFile]);

  useEffect(() => {
    async function persistCurrentPosition(includeHistory = false) {
      const entry = {
        ...route.params,
        scrollY: Math.max(0, Math.round(scrollYRef.current)),
        scrollRatio: Math.max(0, Math.min(1, scrollRatioRef.current || 0)),
        historySnippet: historySnippetRef.current || route.params.simanTitle,
      };

      await saveLastPosition(AsyncStorage, entry);

      if (
        includeHistory &&
        Math.abs(entry.scrollY - initialScrollYRef.current) > 4 &&
        Math.abs(entry.scrollY - lastSavedScrollYRef.current) > 4
      ) {
        await saveRecentPosition(AsyncStorage, entry);
        lastSavedScrollYRef.current = entry.scrollY;
      }
    }

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        persistCurrentPosition(true);
      }
    });

    return () => {
      subscription.remove();
      persistCurrentPosition(true);
    };
  }, [route.params]);

  useEffect(() => {
    const topInjection = buildScaleInjection(fontSize);
    const bottomInjection = buildScaleInjection(fontSize, 0.8);

    topWebViewRef.current?.injectJavaScript(topInjection);
    bottomWebViewRefs.current.mishna?.injectJavaScript(bottomInjection);
    bottomWebViewRefs.current.beur?.injectJavaScript(bottomInjection);
  }, [fontSize]);

  async function changeFont(delta) {
    const next = Math.max(MIN_FONT, Math.min(MAX_FONT, fontSize + delta));
    setFontSize(next);
    await AsyncStorage.setItem(FONT_KEY, String(next));
  }

  function openCommentaryLink(href) {
    const target = parseCommentaryTarget(href, route.params);
    setBottomTab(target.tab);
    setBottomTargets(current => ({
      ...current,
      [target.tab]: {
        file: target.file,
        anchor: target.anchor,
      },
    }));
  }

  function handleTopMessage(event) {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'commentary-link' && payload.href) {
        openCommentaryLink(payload.href);
      } else if (payload.type === 'viewport-context' && payload.snippet) {
        historySnippetRef.current = payload.snippet;
      }
    } catch (error) {
      // Ignore non-JSON bridge messages from page content.
    }
  }

  const webViewProps = {
    allowFileAccess: true,
    allowFileAccessFromFileURLs: true,
    allowUniversalAccessFromFileURLs: true,
    originWhitelist: ['file://*', 'about:*'],
  };

  function handleTopScroll(event) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = contentOffset?.y ?? 0;
    const totalHeight = contentSize?.height ?? 0;
    const viewportHeight = layoutMeasurement?.height ?? 0;
    const maxScroll = Math.max(0, totalHeight - viewportHeight);

    scrollYRef.current = y;
    scrollRatioRef.current = maxScroll > 0 ? y / maxScroll : 0;
  }

  function handleTopLoadEnd() {
    if (!restoreScrollPendingRef.current || scrollYRef.current <= 0) {
      return;
    }

    topWebViewRef.current?.injectJavaScript(
      route.params.scrollRatio > 0
        ? buildRelativeScrollRestoreInjection(route.params.scrollRatio)
        : buildScrollRestoreInjection(scrollYRef.current)
    );
    restoreScrollPendingRef.current = false;
  }

  return (
    <View style={styles.container}>
      <View style={styles.fontBar}>
        <TouchableOpacity style={styles.fontBtn} onPress={() => changeFont(-2)}>
          <Text style={styles.fontBtnText}>א-</Text>
        </TouchableOpacity>
        <Text style={styles.fontLabel}>{fontSize}px</Text>
        <TouchableOpacity style={styles.fontBtn} onPress={() => changeFont(2)}>
          <Text style={styles.fontBtnText}>א+</Text>
        </TouchableOpacity>
      </View>

      <WebView
        ref={topWebViewRef}
        source={{ uri: topUri }}
        injectedJavaScript={buildScaleInjection(fontSize)}
        injectedJavaScriptBeforeContentLoaded={buildLinkInterceptor()}
        onMessage={handleTopMessage}
        onScroll={handleTopScroll}
        onLoadEnd={handleTopLoadEnd}
        textZoom={getScalePercent(fontSize)}
        style={styles.pane}
        {...webViewProps}
      />

      <View style={styles.divider}>
        <TouchableOpacity
          style={[styles.dividerTab, bottomTab === 'mishna' && styles.dividerTabActive]}
          onPress={() => setBottomTab('mishna')}
        >
          <Text style={[styles.dividerTabText, bottomTab === 'mishna' && styles.dividerTabTextActive]}>
            משנה ברורה
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dividerTab, bottomTab === 'beur' && styles.dividerTabActive]}
          onPress={() => setBottomTab('beur')}
        >
          <Text style={[styles.dividerTabText, bottomTab === 'beur' && styles.dividerTabTextActive]}>
            ביאור הלכה
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPaneStack}>
        <WebView
          ref={ref => {
            bottomWebViewRefs.current.mishna = ref;
          }}
          source={{ uri: bottomUris.mishna }}
          injectedJavaScript={buildScaleInjection(fontSize, 0.8)}
          textZoom={getScalePercent(fontSize, 0.8)}
          style={[styles.bottomPaneWebView, bottomTab !== 'mishna' && styles.inactiveBottomPane]}
          pointerEvents={bottomTab === 'mishna' ? 'auto' : 'none'}
          {...webViewProps}
        />
        <WebView
          ref={ref => {
            bottomWebViewRefs.current.beur = ref;
          }}
          source={{ uri: bottomUris.beur }}
          injectedJavaScript={buildScaleInjection(fontSize, 0.8)}
          textZoom={getScalePercent(fontSize, 0.8)}
          style={[styles.bottomPaneWebView, bottomTab !== 'beur' && styles.inactiveBottomPane]}
          pointerEvents={bottomTab === 'beur' ? 'auto' : 'none'}
          {...webViewProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fontBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 12,
  },
  fontBtn: {
    padding: 6,
  },
  fontBtnText: {
    fontSize: 16,
    color: '#333',
  },
  fontLabel: {
    fontSize: 12,
    color: '#666',
  },
  pane: {
    flex: 1,
  },
  bottomPaneStack: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#fff',
  },
  bottomPaneWebView: {
    ...StyleSheet.absoluteFillObject,
  },
  inactiveBottomPane: {
    opacity: 0,
  },
  divider: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    height: 36,
  },
  dividerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37',
  },
  dividerTabText: {
    color: '#888',
    fontSize: 13,
  },
  dividerTabTextActive: {
    color: '#d4af37',
    fontWeight: 'bold',
  },
});
