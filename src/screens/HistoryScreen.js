import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { RECENT_POSITIONS_KEY, LAST_POS_KEY } from '../readerState';

export default function HistoryScreen({ navigation }) {
  const [entries, setEntries] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      AsyncStorage.getItem(RECENT_POSITIONS_KEY).then(value => {
        if (!active) return;
        setEntries(value ? JSON.parse(value) : []);
      });

      return () => {
        active = false;
      };
    }, [])
  );

  async function openEntry(item) {
    await AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify(item));
    navigation.navigate('Reader', item);
  }

  async function clearHistory() {
    await AsyncStorage.removeItem(RECENT_POSITIONS_KEY);
    setEntries([]);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
        <Text style={styles.clearButtonText}>נקה היסטוריה</Text>
      </TouchableOpacity>
      <FlatList
        data={entries}
        keyExtractor={item =>
          `${item.file}:${item.anchor || ''}:${item.scrollY || 0}:${item.savedAt || 0}`
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>אין היסטוריה שמורה עדיין</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => openEntry(item)}>
            <Text style={styles.itemTitle}>{item.simanTitle}</Text>
            <Text style={styles.itemSubtitle}>
              {`${item.file} • offset ${Math.round(item.scrollY || 0)}`}
            </Text>
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
  },
  clearButton: {
    alignSelf: 'flex-start',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#23233a',
  },
  clearButtonText: {
    color: '#d4af37',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8e8ea8',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 32,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e3a',
    backgroundColor: '#151525',
  },
  itemTitle: {
    color: '#e6e6f2',
    fontSize: 15,
    textAlign: 'right',
  },
  itemSubtitle: {
    color: '#8e8ea8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
});
