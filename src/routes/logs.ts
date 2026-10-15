import { NextFunction, Request, Response, Router } from "express";
import { AppDataSource } from "../dataSource";
import { AuditLog } from "../entity/AuditLog";
import { requireAuth } from "../middleware/requireAuth";

export const logsRouter = Router();

logsRouter.use(requireAuth);

// GET /api/logs?limite=200&q=texto
logsRouter.get("/logs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bruto = Number(req.query.limite ?? 200);
    const limite = Number.isInteger(bruto) ? Math.min(Math.max(bruto, 1), 500) : 200;
    const termo = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";

    const qb = AppDataSource.getRepository(AuditLog)
      .createQueryBuilder("l")
      .orderBy("l.id", "DESC")
      .take(limite);

    if (termo) {
      const like = `%${termo.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      qb.where("l.usuario LIKE :t ESCAPE '\\'", { t: like })
        .orWhere("l.acao LIKE :t ESCAPE '\\'", { t: like })
        .orWhere("l.detalhes LIKE :t ESCAPE '\\'", { t: like });
    }

    res.json(await qb.getMany());
  } catch (err) {
    next(err);
  }
});
