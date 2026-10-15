import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "inventario-dev-secret-troque-em-producao";
const TOKEN_EXPIRACAO = process.env.JWT_EXPIRACAO || "12h";

export interface TokenPayload {
  sub: number;
  username: string;
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function compararSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function gerarToken(usuario: { id: number; username: string }): string {
  return jwt.sign(
    { sub: usuario.id, username: usuario.username } satisfies TokenPayload,
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRACAO } as jwt.SignOptions,
  );
}

export function verificarToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
}

/** Validação simples de usuário/senha. Lança mensagem de erro amigável. */
export function validarCredenciais(username: unknown, senha: unknown): {
  username: string;
  senha: string;
} {
  const nome = typeof username === "string" ? username.trim() : "";
  const pass = typeof senha === "string" ? senha : "";

  if (!/^[A-Za-z0-9._-]{3,60}$/.test(nome)) {
    throw new Error("Usuário deve ter de 3 a 60 caracteres (letras, números, ponto, _ ou -).");
  }
  if (pass.length < 4 || pass.length > 100) {
    throw new Error("Senha deve ter de 4 a 100 caracteres.");
  }
  return { username: nome, senha: pass };
}
