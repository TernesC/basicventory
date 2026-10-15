import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

/** Auditoria: grava eventos sem nunca quebrar o fluxo principal. */
@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async registrar(
    acao: string,
    detalhes: string,
    usuario = '',
  ): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          acao,
          detalhes: detalhes.slice(0, 2000),
          usuario,
        }),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Falha ao registrar log:', err);
    }
  }
}
