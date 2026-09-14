export function normalizeCoordinatorName(name: string | null | undefined): string {
  return (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim();
}

const displayName = (name: string) => name.trim().replace(/\s+/g, ' ')
  .toLocaleLowerCase('es-AR').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('es-AR'));

/** Unify formatting and unambiguous first names; never merge two distinct full names. */
export function buildCoordinatorDirectory(names: (string | null | undefined)[]) {
  const labels = new Map<string, string>();
  for (const name of names) {
    const key = normalizeCoordinatorName(name);
    if (!key) continue;
    const label = displayName(name!);
    const current = labels.get(key);
    // Prefer an accented spelling if present among equivalent stored names.
    if (!current || label.localeCompare(current, 'es-AR', { sensitivity: 'variant' }) > 0) labels.set(key, label);
  }
  const aliases = new Map<string, string>();
  for (const key of labels.keys()) {
    if (key.includes(' ')) continue;
    const fullNames = [...labels.keys()].filter(candidate => candidate.startsWith(key + ' '));
    if (fullNames.length === 1) aliases.set(key, fullNames[0]);
  }
  const resolve = (name: string | null | undefined) => {
    const key = normalizeCoordinatorName(name);
    return aliases.get(key) || key;
  };
  const options = [...labels].filter(([key]) => !aliases.has(key))
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es-AR'));
  return { options, resolve };
}
