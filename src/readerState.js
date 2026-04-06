export const LAST_POS_KEY = 'lastPosition';
export const FONT_KEY = 'fontSize';
export const RECENT_POSITIONS_KEY = 'recentPositions';
export const MAX_RECENT_POSITIONS = 20;

function sameHistoryEntry(a, b) {
  const ratioA = a.scrollRatio ?? 0;
  const ratioB = b.scrollRatio ?? 0;

  return (
    a.file === b.file &&
    (a.anchor || '') === (b.anchor || '') &&
    (a.bottomTab || '') === (b.bottomTab || '') &&
    (a.bottomFile || '') === (b.bottomFile || '') &&
    (a.bottomAnchor || '') === (b.bottomAnchor || '') &&
    Math.abs(ratioA - ratioB) < 0.01
  );
}

export async function saveLastPosition(AsyncStorage, entry) {
  await AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify(entry));
}

export async function saveRecentPosition(AsyncStorage, entry) {
  const existing = await AsyncStorage.getItem(RECENT_POSITIONS_KEY);
  const positions = existing ? JSON.parse(existing) : [];
  const deduped = positions.filter(item => !sameHistoryEntry(item, entry));
  const next = [{ ...entry, savedAt: Date.now() }, ...deduped].slice(
    0,
    MAX_RECENT_POSITIONS
  );
  await AsyncStorage.setItem(RECENT_POSITIONS_KEY, JSON.stringify(next));
}
