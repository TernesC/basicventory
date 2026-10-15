import { CATEGORIES, Category, Item } from "./entity/Item";
import { normalizeSearch } from "./search";

/** Localiza a seção ignorando acento/caixa ("perifericos" -> "Periféricos"). */
export function findCategory(value: unknown): Category | undefined {
  if (typeof value !== "string") return undefined;
  const target = normalizeSearch(value);
  return CATEGORIES.find((categoria) => normalizeSearch(categoria) === target);
}

/** Erro HTTP simples com status e mensagem amigável. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const LIMITS = {
  nome: 150,
  localizacao: 150,
  serial: 100,
  patrimonio: 100,
  atribuicao: 150,
  observacao: 2000,
} as const;

const MAX_QUANTIDADE = 100000;

type ItemData = Omit<Item, "id" | "criadoEm" | "atualizadoEm">;

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["true", "1", "sim", "s", "yes", "y"].includes(v);
  }
  return false;
}

/** Converte e valida o corpo enviado pelo formulário. Lança HttpError(400). */
export function readItem(body: unknown): ItemData {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const nome = text(input.nome, LIMITS.nome);
  if (!nome) errors.push("Nome do Item é obrigatório.");

  const categoria = findCategory(input.categoria);
  if (!categoria) {
    errors.push(`Seção inválida. Use uma destas: ${CATEGORIES.join(", ")}.`);
  }

  let quantidadeRaw = input.quantidade;
  if (quantidadeRaw === "" || quantidadeRaw === null || quantidadeRaw === undefined) {
    quantidadeRaw = 1;
  }
  const quantidade = Number(quantidadeRaw);
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    errors.push("Quantidade deve ser um número inteiro maior ou igual a zero.");
  } else if (quantidade > MAX_QUANTIDADE) {
    errors.push(`Quantidade não pode passar de ${MAX_QUANTIDADE}.`);
  }

  if (errors.length > 0) throw new HttpError(400, errors.join(" "));

  return {
    nome,
    categoria: categoria as Category,
    quantidade,
    localizacao: text(input.localizacao, LIMITS.localizacao),
    serial: text(input.serial, LIMITS.serial),
    patrimonio: text(input.patrimonio, LIMITS.patrimonio),
    danificado: toBoolean(input.danificado),
    atribuicao: text(input.atribuicao, LIMITS.atribuicao),
    observacao: text(input.observacao, LIMITS.observacao),
  };
}

/** Converte id da URL em número válido ou lança 400. */
export function readId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Identificador inválido.");
  return id;
}
