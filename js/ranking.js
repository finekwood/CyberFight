export function loadRankings(config) {
  try {
    const raw = localStorage.getItem(config.storageKey);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? sortRankings(rows).slice(0, config.limit) : [];
  } catch {
    return [];
  }
}

export function saveRanking(config, entry) {
  const rows = loadRankings(config);
  rows.push(entry);
  const sorted = sortRankings(rows).slice(0, config.limit);
  localStorage.setItem(config.storageKey, JSON.stringify(sorted));
  return {
    rows: sorted,
    rank: sorted.findIndex((row) => row.id === entry.id) + 1,
    isNewRecord: sorted[0]?.id === entry.id
  };
}

export function sortRankings(rows) {
  return [...rows].sort((a, b) => {
    if ((b.distance || 0) !== (a.distance || 0)) return (b.distance || 0) - (a.distance || 0);
    if (b.time !== a.time) return b.time - a.time;
    if (b.killCount !== a.killCount) return b.killCount - a.killCount;
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const secs = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

export function formatDistance(distance) {
  const meters = Math.max(0, Math.floor(distance || 0));
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${meters}m`;
}
