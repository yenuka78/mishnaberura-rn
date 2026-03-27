import { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FONT_KEY = 'fontSize';
const DEFAULT_FONT = 16;

const TABS = [
  { key: 'main', label: 'שו"ע ומ"ב' },
  { key: 'mishna', label: 'משנה ברורה' },
  { key: 'beur', label: 'ביאור הלכה' },
];

// Inject CSS to override font size and add RTL body
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
  const [tab, setTab] = useState('main');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const webViewRef = useRef(null);

  AsyncStorage.getItem(FONT_KEY).then(val => {
    if (val) setFontSize(parseInt(val, 10));
  });

  function changeFont(delta) {
    const next = Math.max(10, Math.min(28, fontSize + delta));
    setFontSize(next);
    AsyncStorage.setItem(FONT_KEY, String(next));
  }

  function getUri() {
    const base =
      tab === 'main' ? file :
      tab === 'mishna' ? mishnaFile :
      beurFile;
    const hash = tab === 'main' ? anchor : anchor.replace('ReportNum', 'Mishna').replace('_L2', '_L2');
    // Main text uses HtmpReportNum anchor; mishna uses HtmpMishna; beur uses HtmpBeur
    // For simplicity, navigate to start of file for mishna/beur tabs
    if (tab === 'main') {
      return `file:///android_asset/${base}#${anchor}`;
    }
    return `file:///android_asset/${base}`;
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.activeTab]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.activeTabText]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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

      {/* WebView */}
      <WebView
        ref={webViewRef}
        key={tab + anchor}
        source={{ uri: getUri() }}
        injectedJavaScript={buildInjectedJS(fontSize)}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['file://*', 'about:*']}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
  },
  activeTabText: {
    color: '#d4af37',
    fontWeight: 'bold',
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
  webview: {
    flex: 1,
  },
});
