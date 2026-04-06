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

export default function ReaderScreen({ route }) {
  const {
    file, mishnaFile, beurFile, anchor,
  } = route.params;

  const topWebViewRef = useRef(null);
  const bottomWebViewRef = useRef(null);
  const scrollYRef = useRef(route.params.scrollY ?? 0);
  const initialScrollYRef = useRef(route.params.scrollY ?? 0);
  const restoreScrollPendingRef = useRef((route.params.scrollY ?? 0) > 0);
  const lastSavedScrollYRef = useRef(route.params.scrollY ?? 0);

  const [bottomTab, setBottomTab] = useState(route.params.bottomTab ?? 'mishna');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [bottomTarget, setBottomTarget] = useState({
    file: route.params.bottomFile ?? mishnaFile,
    anchor: route.params.bottomAnchor ?? '',
  });

  const topUri = useMemo(() => buildAssetUri(file, anchor), [file, anchor]);
  const bottomUri = useMemo(
    () => buildAssetUri(bottomTarget.file, bottomTarget.anchor),
    [bottomTarget]
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
    initialScrollYRef.current = route.params.scrollY ?? 0;
    restoreScrollPendingRef.current = (route.params.scrollY ?? 0) > 0;
    lastSavedScrollYRef.current = route.params.scrollY ?? 0;
    setBottomTab(route.params.bottomTab ?? 'mishna');
    setBottomTarget({
      file: route.params.bottomFile ?? mishnaFile,
      anchor: route.params.bottomAnchor ?? '',
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
    bottomWebViewRef.current?.injectJavaScript(bottomInjection);
  }, [fontSize]);

  useEffect(() => {
    const nextFile = bottomTab === 'mishna' ? mishnaFile : beurFile;
    setBottomTarget(current => {
      if (current.file === nextFile) return current;
      return { file: nextFile, anchor: '' };
    });
  }, [bottomTab, mishnaFile, beurFile]);

  async function changeFont(delta) {
    const next = Math.max(MIN_FONT, Math.min(MAX_FONT, fontSize + delta));
    setFontSize(next);
    await AsyncStorage.setItem(FONT_KEY, String(next));
  }

  function openCommentaryLink(href) {
    const target = parseCommentaryTarget(href, route.params);
    setBottomTab(target.tab);
    setBottomTarget({
      file: target.file,
      anchor: target.anchor,
    });
  }

  function handleTopMessage(event) {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'commentary-link' && payload.href) {
        openCommentaryLink(payload.href);
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
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }

  function handleTopLoadEnd() {
    if (!restoreScrollPendingRef.current || scrollYRef.current <= 0) {
      return;
    }

    topWebViewRef.current?.injectJavaScript(
      buildScrollRestoreInjection(scrollYRef.current)
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

      <WebView
        key={bottomUri}
        ref={bottomWebViewRef}
        source={{ uri: bottomUri }}
        injectedJavaScript={buildScaleInjection(fontSize, 0.8)}
        textZoom={getScalePercent(fontSize, 0.8)}
        style={styles.pane}
        {...webViewProps}
      />
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
