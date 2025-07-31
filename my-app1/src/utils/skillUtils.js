// src/utils/skillUtils.js
/**
 * Merge two arrays of skills, keeping only unique entries (case-insensitive)
 */
export function uniqueMerge(existing, toAdd) {
    const lower = new Set(existing.map(s => s.toLowerCase()));
    return [
      ...existing,
      ...toAdd.filter(s => !lower.has(s.toLowerCase())),
    ];
  }
  