import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";
import { AuditLog } from "./entity/AuditLog";
import { Item } from "./entity/Item";
import { User } from "./entity/User";
import { normalizeSearch } from "./search";

const rootDir = path.resolve(__dirname, "..");
export const dataDir = path.join(rootDir, "data");
export const publicDir = path.join(rootDir, "public");
export const databaseFile = path.join(dataDir, "inventario.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: databaseFile,
  entities: [Item, User, AuditLog],
  synchronize: true,
  logging: false,
  // Registra funções customizadas no SQLite antes de qualquer uso.
  prepareDatabase: (db) => {
    db.function("busca", { deterministic: true }, (value: unknown) => normalizeSearch(value));
  },
});
