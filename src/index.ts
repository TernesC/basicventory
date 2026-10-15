import "reflect-metadata";
import express, { ErrorRequestHandler } from "express";
import path from "node:path";
import { hashSenha } from "./auth";
import { AppDataSource, databaseFile, publicDir } from "./dataSource";
import { User } from "./entity/User";
import { registrarLog } from "./logs";
import { authRouter } from "./routes/auth";
import { itensRouter } from "./routes/itens";
import { logsRouter } from "./routes/logs";
import { HttpError } from "./validation";

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PADRAO = { username: "admin", senha: "admin123" };

/** Cria o usuário admin inicial quando o banco ainda não tem usuários. */
async function garantirAdminInicial(): Promise<void> {
  const repo = AppDataSource.getRepository(User);
  const total = await repo.count();
  if (total > 0) return;

  await repo.save(
    repo.create({
      username: ADMIN_PADRAO.username,
      senhaHash: await hashSenha(ADMIN_PADRAO.senha),
    }),
  );
  await registrarLog("sistema", `Usuário inicial "${ADMIN_PADRAO.username}" criado.`, "sistema");
  console.log(
    `Usuário inicial criado -> login: ${ADMIN_PADRAO.username} | senha: ${ADMIN_PADRAO.senha} (troque criando outro usuário e excluindo este, se desejar)`,
  );
}

async function main() {
  await AppDataSource.initialize();
  await garantirAdminInicial();

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", authRouter);
  app.use("/api", itensRouter);
  app.use("/api", logsRouter);

  app.use(express.static(publicDir));
  // Rota coringa do frontend (Express 4): atende index.html para qualquer rota não-API.
  app.use((_req, res) => res.sendFile(path.join(publicDir, "index.html")));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ erro: err.message });
      return;
    }
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ erro: "JSON inválido no corpo da requisição." });
      return;
    }
    console.error(err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  };
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`Inventário rodando em http://localhost:${PORT}`);
    console.log(`Banco de dados: ${databaseFile}`);
  });
}

main().catch((err) => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});
