import { NextFunction, Request, Response, Router } from "express";
import { AppDataSource } from "../dataSource";
import { User } from "../entity/User";
import { compararSenha, validarCredenciais } from "../auth";
import { gerarToken } from "../auth";
import { registrarLog } from "../logs";
import { HttpError, readId } from "../validation";
import { requireAuth } from "../middleware/requireAuth";

export const authRouter = Router();

function users() {
  return AppDataSource.getRepository(User);
}

/** POST /api/auth/login { username, senha } -> { token, usuario } */
authRouter.post("/auth/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const nome = typeof body.username === "string" ? body.username.trim() : "";
    const senha = typeof body.senha === "string" ? body.senha : "";
    if (!nome || !senha) {
      throw new HttpError(400, "Informe usuário e senha.");
    }

    const usuario = await users()
      .createQueryBuilder("u")
      .where("LOWER(u.username) = LOWER(:nome)", { nome })
      .getOne();

    if (!usuario || !(await compararSenha(senha, usuario.senhaHash))) {
      await registrarLog("login.falha", `Tentativa de login para "${nome.slice(0, 60)}".`, nome);
      throw new HttpError(401, "Usuário ou senha inválidos.");
    }

    const token = gerarToken({ id: usuario.id, username: usuario.username });
    await registrarLog("login", "Login realizado.", usuario.username);
    res.json({ token, usuario: { id: usuario.id, username: usuario.username } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/me -> dados do usuário logado */
authRouter.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json({ usuario: req.usuario });
});

/** POST /api/auth/logout -> só registra o evento (o token é descartado no cliente) */
authRouter.post("/auth/logout", requireAuth, async (req: Request, res: Response) => {
  await registrarLog("logout", "Sessão encerrada.", req.usuario?.username ?? "");
  res.status(204).end();
});

/** GET /api/usuarios -> lista sem hash de senha */
authRouter.get("/usuarios", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const lista = await users()
      .createQueryBuilder("u")
      .select(["u.id", "u.username", "u.criadoEm"])
      .orderBy("u.username", "ASC")
      .getMany();
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

/** POST /api/usuarios { username, senha } -> cria usuário simples */
authRouter.post("/usuarios", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    let credenciais: { username: string; senha: string };
    try {
      credenciais = validarCredenciais(body.username, body.senha);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }

    const existente = await users()
      .createQueryBuilder("u")
      .where("LOWER(u.username) = LOWER(:nome)", { nome: credenciais.username })
      .getOne();
    if (existente) throw new HttpError(409, "Esse nome de usuário já está em uso.");

    const { hashSenha } = await import("../auth");
    const novo = await users().save(
      users().create({
        username: credenciais.username,
        senhaHash: await hashSenha(credenciais.senha),
      }),
    );
    await registrarLog(
      "usuario.criar",
      `Usuário "${novo.username}" criado.`,
      req.usuario?.username ?? "",
    );
    res.status(201).json({ id: novo.id, username: novo.username, criadoEm: novo.criadoEm });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/usuarios/:id -> exclui usuário (sem auto-exclusão nem último usuário) */
authRouter.delete(
  "/usuarios/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = readId(req.params.id);
      if (id === req.usuario?.id) throw new HttpError(400, "Você não pode excluir o próprio usuário.");
      const alvo = await users().findOneBy({ id });
      if (!alvo) throw new HttpError(404, "Usuário não encontrado.");
      const total = await users().count();
      if (total <= 1) throw new HttpError(400, "Não é possível excluir o último usuário.");

      await users().delete({ id });
      await registrarLog(
        "usuario.excluir",
        `Usuário "${alvo.username}" excluído.`,
        req.usuario?.username ?? "",
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
