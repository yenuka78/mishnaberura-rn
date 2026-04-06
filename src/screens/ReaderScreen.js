import { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FONT_KEY = 'fontSize';
const DEFAULT_FONT = 16;

function buildInjectedJS(fontSize) {
  return `
    (function() {
      var style = document.createElement('style');
      style.textContent = 'body { font-size: ${fontSize}px !important; background: #fff; }';
      document.head.appendChild(style);
    })();
    true;
  `;
}

export default function ReaderScreen({ route }) {
  const { file, mishnaFile, beurFile, anchor } = route.params;
  const [bottomTab, setBottomTab] = useState('mishna');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);

  AsyncStorage.getItem(FONT_KEY).then(val => {
    if (val) setFontSize(parseInt(val, 10));
  });

  function changeFont(delta) {
    const next = Math.max(10, Math.min(28, fontSize + delta));
    setFontSize(next);
    AsyncStorage.setItem(FONT_KEY, String(next));
  }

  const topUri = `file:///android_asset/${file}#${anchor}`;
  const bottomUri = bottomTab === 'mishna'
    ? `file:///android_asset/${mishnaFile}`
    : `file:///android_asset/${beurFile}`;

  const webViewProps = {
    allowFileAccess: true,
    allowFileAccessFromFileURLs: true,
    allowUniversalAccessFromFileURLs: true,
    originWhitelist: ['file://*', 'about:*'],
  };

  return (
    <View style={styles.container}>
      {/* Font controls */}
      <View style={styles.fontBar}>
        <TouchableOpacity style={styles.fontBtn} onPress={() => changeFont(-2)}>
          <Text style={styles.fontBtnText}>א-</Text>
        </TouchableOpacity>
        <Text style={styles.fontLabel}>{fontSize}px</Text>
        <TouchableOpacity style={styles.fontBtn} onPress={() => changeFont(2)}>
          <Text style={styles.fontBtnText}>א+</Text>
        </TouchableOpacity>
      </View>

      {/* Top pane - main text (שו"ע) */}
      <WebView
        key={topUri}
        source={{ uri: topUri }}
        injectedJavaScript={buildInjectedJS(fontSize)}
        style={styles.pane}
        {...webViewProps}
      />

      {/* Divider with bottom tab toggle */}
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

      {/* Bottom pane - explanation */}
      <WebView
        key={bottomUri}
        source={{ uri: bottomUri }}
        injectedJavaScript={buildInjectedJS(Math.round(fontSize * 0.9))}
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
