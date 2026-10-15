import { NextFunction, Request, Response, Router } from "express";
import { Brackets, In } from "typeorm";
import { AppDataSource } from "../dataSource";
import { CATEGORIES, Item } from "../entity/Item";
import { HttpError, findCategory, readId, readItem } from "../validation";
import { requireAuth } from "../middleware/requireAuth";
import { registrarLog } from "../logs";

export const itensRouter = Router();

itensRouter.use(requireAuth);

const SEARCH_FIELDS = [
  "nome",
  "localizacao",
  "serial",
  "patrimonio",
  "atribuicao",
  "observacao",
] as const;

function items() {
  return AppDataSource.getRepository(Item);
}

/** Escapa curingas do LIKE e usa ESCAPE padrão. */
function likeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// GET /api/itens?categoria=Notebooks&q=texto&nome=...&localizacao=...&serial=...&patrimonio=...&atribuicao=...&observacao=...&quantidade=...&danificado=sim|nao
itensRouter.get("/itens", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const qb = items().createQueryBuilder("i");

    const categoriaRaw = typeof req.query.categoria === "string" ? req.query.categoria.trim() : "";
    if (categoriaRaw) {
      const categoria = findCategory(categoriaRaw);
      if (!categoria) {
        throw new HttpError(400, `Seção inválida. Use uma destas: ${CATEGORIES.join(", ")}.`);
      }
      qb.andWhere("i.categoria = :categoria", { categoria });
    }

    const term = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (term) {
      qb.andWhere(
        new Brackets((where) => {
          SEARCH_FIELDS.forEach((field, index) => {
            // busca() = função SQL registrada em dataSource (sem acento e sem caixa)
            const clause = `busca(i.${field}) LIKE busca(:q) ESCAPE '\\'`;
            if (index === 0) where.where(clause);
            else where.orWhere(clause);
          });
        }),
      ).setParameter("q", `%${likeTerm(term)}%`);
    }

    // Filtros por coluna (combinados com AND). Texto usa busca LIKE parcial.
    const colunasTexto = [
      "nome",
      "localizacao",
      "serial",
      "patrimonio",
      "atribuicao",
      "observacao",
    ] as const;
    colunasTexto.forEach((field) => {
      const raw = typeof req.query[field] === "string" ? (req.query[field] as string).trim() : "";
      if (!raw) return;
      qb.andWhere(`busca(i.${field}) LIKE busca(:filtro_${field}) ESCAPE '\\'`, {
        [`filtro_${field}`]: `%${likeTerm(raw)}%`,
      });
    });

    const qtdRaw =
      typeof req.query.quantidade === "string" ? req.query.quantidade.trim() : "";
    if (qtdRaw) {
      const qtd = Number(qtdRaw);
      if (!Number.isNaN(qtd)) qb.andWhere("i.quantidade = :quantidade", { quantidade: qtd });
    }

    const danRaw =
      typeof req.query.danificado === "string" ? req.query.danificado.trim().toLowerCase() : "";
    if (danRaw) {
      if (["sim", "s", "true", "1"].includes(danRaw)) qb.andWhere("i.danificado = :danificado", { danificado: true });
      else if (["nao", "não", "n", "false", "0"].includes(danRaw))
        qb.andWhere("i.danificado = :danificado", { danificado: false });
    }

    qb.orderBy("i.nome", "ASC").addOrderBy("i.id", "DESC");
    res.json(await qb.getMany());
  } catch (err) {
    next(err);
  }
});

// GET /api/itens/sugestoes?q=termo&campo=nome|localizacao&categoria=Notebooks
// Autocomplete dos campos "Nome do Item" e "Localização": agrupa valores
// iguais (sem acento/caixa) por seção e retorna o valor mais recente de cada
// grupo com a contagem. A categoria é opcional e só prioriza, sem filtrar.
// Resposta: [{ valor, categoria, repeticoes }]
itensRouter.get("/itens/sugestoes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const termo = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (termo.length < 2) {
      res.json([]);
      return;
    }

    const campoRaw =
      typeof req.query.campo === "string" ? req.query.campo.trim().toLowerCase() : "nome";
    const campo = campoRaw === "localizacao" ? "localizacao" : "nome";
    const coluna = campo === "nome" ? "i.nome" : "i.localizacao";

    const catRaw = typeof req.query.categoria === "string" ? req.query.categoria.trim() : "";
    const prioridade = catRaw ? (findCategory(catRaw) ?? null) : null;

    const like = `%${likeTerm(termo)}%`;
    const prefixo = `${likeTerm(termo)}%`;
    const repo = items();

    const qb = repo
      .createQueryBuilder("i")
      .select("MAX(i.id)", "ultimoId")
      .addSelect("i.categoria", "categoria")
      .addSelect("COUNT(*)", "total")
      .where(`busca(${coluna}) LIKE busca(:like) ESCAPE '\\'`, { like })
      .groupBy(`busca(${coluna})`)
      .addGroupBy("i.categoria")
      .take(8);

    if (campo === "localizacao") qb.andWhere("i.localizacao <> ''");

    if (prioridade) {
      qb
        .orderBy("CASE WHEN i.categoria = :prioridade THEN 0 ELSE 1 END")
        .addOrderBy(`CASE WHEN busca(${coluna}) LIKE busca(:prefixo) ESCAPE '\\' THEN 0 ELSE 1 END`)
        .addOrderBy("ultimoId", "DESC")
        .setParameter("prioridade", prioridade);
    } else {
      qb
        .orderBy(`CASE WHEN busca(${coluna}) LIKE busca(:prefixo) ESCAPE '\\' THEN 0 ELSE 1 END`)
        .addOrderBy("ultimoId", "DESC");
    }
    qb.setParameter("prefixo", prefixo);

    const grupos: Array<{ ultimoId: string; categoria: string; total: string }> =
      await qb.getRawMany();
    if (grupos.length === 0) {
      res.json([]);
      return;
    }

    const ids = grupos.map((g) => Number(g.ultimoId));
    const recentes = await repo.findBy({ id: In(ids) });
    const porId = new Map(recentes.map((item) => [item.id, item]));

    res.json(
      grupos.flatMap((g) => {
        const item = porId.get(Number(g.ultimoId));
        if (!item) return [];
        const valor = campo === "nome" ? item.nome : item.localizacao;
        if (!valor) return [];
        return [{ valor, categoria: g.categoria, repeticoes: Number(g.total) || 1 }];
      }),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/resumo -> contagem de itens e unidades por seção
itensRouter.get("/resumo", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows: Array<{ categoria: string; total: string; unidades: string | null }> =
      await items()
        .createQueryBuilder("i")
        .select("i.categoria", "categoria")
        .addSelect("COUNT(*)", "total")
        .addSelect("SUM(i.quantidade)", "unidades")
        .groupBy("i.categoria")
        .getRawMany();

    const porSecao: Record<string, { itens: number; unidades: number }> = {};
    for (const categoria of CATEGORIES) porSecao[categoria] = { itens: 0, unidades: 0 };
    for (const row of rows) {
      if (row.categoria in porSecao) {
        porSecao[row.categoria] = {
          itens: Number(row.total) || 0,
          unidades: Number(row.unidades) || 0,
        };
      }
    }

    const total = Object.values(porSecao).reduce((acc, v) => acc + v.itens, 0);
    const unidades = Object.values(porSecao).reduce((acc, v) => acc + v.unidades, 0);
    res.json({ porSecao, total, unidades });
  } catch (err) {
    next(err);
  }
});

// POST /api/itens
itensRouter.post("/itens", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = readItem(req.body);
    const item = await items().save(items().create(data));
    await registrarLog(
      "item.criar",
      `#${item.id} "${item.nome}" em ${item.categoria} (qtd ${item.quantidade}).`,
      req.usuario?.username ?? "",
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/itens/:id
itensRouter.put("/itens/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = readId(req.params.id);
    const item = await items().findOneBy({ id });
    if (!item) throw new HttpError(404, "Item não encontrado.");

    Object.assign(item, readItem(req.body));
    const saved = await items().save(item);
    await registrarLog(
      "item.editar",
      `#${saved.id} "${saved.nome}" em ${saved.categoria} (qtd ${saved.quantidade}).`,
      req.usuario?.username ?? "",
    );
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/itens/:id
itensRouter.delete("/itens/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = readId(req.params.id);
    const alvo = await items().findOneBy({ id });
    if (!alvo) throw new HttpError(404, "Item não encontrado.");
    await items().delete({ id });
    await registrarLog(
      "item.excluir",
      `#${id} "${alvo.nome}" removido de ${alvo.categoria}.`,
      req.usuario?.username ?? "",
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/itens/:id (consulta pontual)
itensRouter.get("/itens/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = readId(req.params.id);
    const item = await items().findOneBy({ id });
    if (!item) throw new HttpError(404, "Item não encontrado.");
    res.json(item);
  } catch (err) {
    next(err);
  }
});
