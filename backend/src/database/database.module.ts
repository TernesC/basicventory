import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AuditLog } from '../logs/audit-log.entity';
import { User } from '../auth/user.entity';
import { Item } from '../itens/item.entity';
import { normalizeSearch } from '../common/search.util';

const dataDir =
  process.env.DATA_DIR ??
  (path.basename(process.cwd()) === 'backend'
    ? path.resolve(process.cwd(), '..', 'data')
    : path.resolve(process.cwd(), 'data'));
fs.mkdirSync(dataDir, { recursive: true });

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database:
        process.env.DATABASE_FILE || path.join(dataDir, 'inventario.sqlite'),
      entities: [Item, User, AuditLog],
      synchronize: true,
      logging: false,
      // Registra funções customizadas no SQLite antes de qualquer uso.
      prepareDatabase: (db) => {
        db.function(
          'busca',
          { deterministic: true },
          (value: unknown) => normalizeSearch(value),
        );
      },
    }),
  ],
})
export class DatabaseModule {}
