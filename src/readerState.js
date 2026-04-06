export const LAST_POS_KEY = 'lastPosition';
export const FONT_KEY = 'fontSize';
export const RECENT_POSITIONS_KEY = 'recentPositions';
export const MAX_RECENT_POSITIONS = 20;

export async function saveRecentPosition(AsyncStorage, entry) {
  const existing = await AsyncStorage.getItem(RECENT_POSITIONS_KEY);
  const positions = existing ? JSON.parse(existing) : [];
  const deduped = positions.filter(
    item => !(item.file === entry.file && item.anchor === entry.anchor)
  );
  const next = [{ ...entry, savedAt: Date.now() }, ...deduped].slice(
    0,
    MAX_RECENT_POSITIONS
  );
  await AsyncStorage.setItem(RECENT_POSITIONS_KEY, JSON.stringify(next));
}
