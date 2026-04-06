import { useDeferredValue, useMemo, useState } from 'react';
import MiniSearch from 'minisearch';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { MINI_SEARCH_INDEX } from '../searchIndex.generated';
import { normalizeSearchText } from '../searchUtils';

const MINI_SEARCH_OPTIONS = {
  fields: ['title', 'text'],
  storeFields: [
    'kind',
    'file',
    'baseFile',
    'mishnaFile',
    'beurFile',
    'anchor',
    'label',
    'title',
    'preview',
  ],
};

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const miniSearch = useMemo(
    () => MiniSearch.loadJS(MINI_SEARCH_INDEX, MINI_SEARCH_OPTIONS),
    []
  );

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredQuery);
    if (normalizedQuery.length < 2) {
      return [];
    }

    return miniSearch.search(normalizedQuery, {
      boost: { title: 3 },
      combineWith: 'AND',
      prefix: term => term.length >= 3,
      fuzzy: term => (term.length >= 4 ? 0.2 : false),
    }).slice(0, 100);
  }, [deferredQuery, miniSearch]);

  function openResult(entry) {
    const params = {
      file: entry.baseFile,
      mishnaFile: entry.mishnaFile,
      beurFile: entry.beurFile,
      anchor: entry.kind === 'main' ? entry.anchor : '',
      simanTitle: entry.title,
      scrollY: 0,
    };

    if (entry.kind === 'mishna' || entry.kind === 'beur') {
      params.bottomTab = entry.kind === 'beur' ? 'beur' : 'mishna';
      params.bottomFile = entry.file;
      params.bottomAnchor = entry.anchor;
    }

    navigation.navigate('Reader', params);
  }

  return (
    <View style={styles.container}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="חיפוש בכל הדפים"
        placeholderTextColor="#70708b"
        style={styles.input}
        textAlign="right"
        value={query}
        onChangeText={setQuery}
      />
      {normalizeSearchText(deferredQuery).length < 2 ? (
        <Text style={styles.helperText}>הקלד לפחות 2 תווים כדי לחפש בכל הספר</Text>
      ) : (
        <Text style={styles.helperText}>{results.length} תוצאות</Text>
      )}
      <FlatList
        data={results}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => openResult(item)}>
            <Text style={styles.itemMeta}>{item.label}</Text>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemPreview}>{item.preview}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    paddingTop: 12,
  },
  input: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    backgroundColor: '#151525',
    color: '#f4f4f9',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  helperText: {
    color: '#9c9cb8',
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 8,
    textAlign: 'right',
  },
  item: {
    backgroundColor: '#151525',
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f34',
  },
  itemMeta: {
    color: '#d4af37',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
  },
  itemTitle: {
    color: '#f2f2fa',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'right',
  },
  itemPreview: {
    color: '#b9b9cd',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
});
