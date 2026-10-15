import { AppDataSource } from "./dataSource";
import { AuditLog } from "./entity/AuditLog";

/** Grava um evento no log de auditoria. Nunca quebra o fluxo principal. */
export async function registrarLog(
  acao: string,
  detalhes: string,
  usuario = "",
): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(AuditLog);
    await repo.save(repo.create({ acao, detalhes: detalhes.slice(0, 2000), usuario }));
  } catch (err) {
    console.error("Falha ao registrar log:", err);
  }
}
