import { useState, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUBJECTS, simanAnchor } from '../data';
import { LAST_POS_KEY } from '../readerState';

export default function HomeScreen({ navigation }) {
  const [expanded, setExpanded] = useState(null);

  // Restore last position on mount
  useEffect(() => {
    AsyncStorage.getItem(LAST_POS_KEY).then(val => {
      if (val) {
        const pos = JSON.parse(val);
        navigation.navigate('Reader', pos);
      }
    });
  }, []);

  const sections = SUBJECTS.map((subject, subjectIndex) => ({
    title: subject.label,
    subjectIndex,
    data: expanded === subjectIndex ? subject.simanim : [],
  }));

  function openSiman(subjectIndex, childIndex) {
    const subject = SUBJECTS[subjectIndex];
    const simanOffset = childIndex + 1;
    const anchorIndex = subject.startSiman + simanOffset - 1;
    const params = {
      file: subject.file,
      mishnaFile: subject.mishnaFile,
      beurFile: subject.beurFile,
      anchor: simanAnchor(anchorIndex),
      simanTitle: subject.simanim[childIndex],
    };
    AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify(params));
    navigation.navigate('Reader', params);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={styles.toolbarButtonText}>חיפוש</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.toolbarButtonText}>היסטוריה</Text>
        </TouchableOpacity>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item + index}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() =>
              setExpanded(prev =>
                prev === section.subjectIndex ? null : section.subjectIndex
              )
            }
          >
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <Text style={styles.chevron}>
              {expanded === section.subjectIndex ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        )}
        renderItem={({ item, index, section }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => openSiman(section.subjectIndex, index)}
          >
            <Text style={styles.itemText}>{item}</Text>
          </TouchableOpacity>
        )}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#171728',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  toolbarButton: {
    flex: 1,
    backgroundColor: '#23233a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#34345a',
  },
  toolbarButtonText: {
    color: '#d4af37',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionHeaderText: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
  },
  chevron: {
    color: '#d4af37',
    fontSize: 12,
    marginLeft: 8,
  },
  item: {
    backgroundColor: '#151525',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e3a',
  },
  itemText: {
    color: '#c0c0e0',
    fontSize: 14,
    textAlign: 'right',
  },
});
