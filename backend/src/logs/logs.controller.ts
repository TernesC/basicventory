import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditLog } from './audit-log.entity';

@ApiTags('logs')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista auditoria (mais recentes primeiro)' })
  @ApiQuery({ name: 'limite', required: false, example: 200 })
  @ApiQuery({ name: 'q', required: false })
  @ApiResponse({ status: 200 })
  async listar(
    @Query('limite') limiteRaw?: string,
    @Query('q') q?: string,
  ): Promise<AuditLog[]> {
    const bruto = Number(limiteRaw ?? 200);
    const limite = Number.isInteger(bruto)
      ? Math.min(Math.max(bruto, 1), 500)
      : 200;
    const termo = typeof q === 'string' ? q.trim().slice(0, 100) : '';

    const qb = this.repo
      .createQueryBuilder('l')
      .orderBy('l.id', 'DESC')
      .take(limite);

    if (termo) {
      const like = `%${termo.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      qb.where("l.usuario LIKE :t ESCAPE '\\'", { t: like })
        .orWhere("l.acao LIKE :t ESCAPE '\\'", { t: like })
        .orWhere("l.detalhes LIKE :t ESCAPE '\\'", { t: like });
    }

    return qb.getMany();
  }
}
