/**
 * Normaliza texto para comparação ignorando acentos e caixa.
 * É registrada no SQLite como função `busca` (ver dataSource.ts).
 */
export function normalizeSearch(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
