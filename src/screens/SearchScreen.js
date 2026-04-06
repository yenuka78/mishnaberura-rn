import { useDeferredValue, useMemo, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import SEARCH_INDEX from '../searchIndex.generated';
import { normalizeSearchText } from '../searchUtils';

function scoreEntry(entry, normalizedQuery, terms) {
  const title = normalizeSearchText(entry.title);
  let score = 0;

  if (title.includes(normalizedQuery)) score += 80;
  if (entry.searchText.includes(normalizedQuery)) score += 20;

  for (const term of terms) {
    if (title.startsWith(term)) score += 20;
    else if (title.includes(term)) score += 12;
    else if (entry.searchText.includes(term)) score += 4;
    else return -1;
  }

  return score;
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredQuery);
    if (normalizedQuery.length < 2) {
      return [];
    }

    const terms = normalizedQuery.split(' ').filter(Boolean);

    return SEARCH_INDEX
      .map(entry => ({
        entry,
        score: scoreEntry(entry, normalizedQuery, terms),
      }))
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100)
      .map(item => item.entry);
  }, [deferredQuery]);

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
