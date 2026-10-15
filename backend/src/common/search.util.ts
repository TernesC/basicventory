/**
 * Normaliza texto para comparação ignorando acentos e caixa.
 * É registrada no SQLite como função `busca` (ver database module).
 */
export function normalizeSearch(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Localiza a seção ignorando acento/caixa ("perifericos" -> "Periféricos"). */
export function findCategory(
  value: unknown,
  categories: readonly string[],
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const target = normalizeSearch(value);
  return categories.find(
    (categoria) => normalizeSearch(categoria) === target,
  );
}

/** Escapa curingas do LIKE e usa ESCAPE padrão. */
export function likeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
