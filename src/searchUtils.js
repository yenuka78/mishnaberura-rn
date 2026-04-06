export function normalizeSearchText(text) {
  return text
    .replace(/&nbsp;?/gi, ' ')
    .replace(/["'`׳״.,;:!?()[\]{}<>/\\|+=_*~^-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
