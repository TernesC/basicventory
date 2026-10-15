import { NextFunction, Request, Response } from "express";
import { verificarToken } from "../auth";

export interface AuthUser {
  id: number;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: AuthUser;
    }
  }
}

/** Exige `Authorization: Bearer <token>`. Responde 401 quando ausente/inválido. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const [esquema, token] = header.split(" ");
  if (esquema !== "Bearer" || !token) {
    res.status(401).json({ erro: "Sessão expirada ou inexistente. Faça login novamente." });
    return;
  }
  try {
    const payload = verificarToken(token);
    req.usuario = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.status(401).json({ erro: "Sessão expirada ou inválida. Faça login novamente." });
  }
}
