import { Module } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ItensModule } from './itens/itens.module';
import { LogsModule } from './logs/logs.module';

export function frontendDist(): string | null {
  const candidates = [
    // backend/../frontend/dist/frontend/browser (ng build padrão)
    path.resolve(process.cwd(), '..', 'frontend', 'dist', 'frontend', 'browser'),
    path.resolve(process.cwd(), 'frontend', 'dist', 'frontend', 'browser'),
    // fallback: ng build sem application builder
    path.resolve(process.cwd(), '..', 'frontend', 'dist', 'frontend'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

@Module({
  imports: [DatabaseModule, LogsModule, AuthModule, ItensModule],
})
export class AppModule {}
