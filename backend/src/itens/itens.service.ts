import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { LogsService } from '../logs/logs.service';
import { findCategory, likeTerm } from '../common/search.util';
import { AtualizarItemDto, CriarItemDto } from './item.dto';
import { CATEGORIES, Item } from './item.entity';

const SEARCH_FIELDS = [
  'nome',
  'localizacao',
  'serial',
  'patrimonio',
  'atribuicao',
  'observacao',
] as const;

export interface Sugestao {
  valor: string;
  categoria: string;
  repeticoes: number;
}

@Injectable()
export class ItensService {
  constructor(
    @InjectRepository(Item) private readonly itens: Repository<Item>,
    private readonly logs: LogsService,
  ) {}

  private categoriaOuErro(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    const categoria = findCategory(raw, CATEGORIES);
    if (!categoria) {
      throw new BadRequestException(
        `Seção inválida. Use uma destas: ${CATEGORIES.join(', ')}.`,
      );
    }
    return categoria;
  }

  async listar(categoriaRaw?: string, q?: string): Promise<Item[]> {
    const qb = this.itens.createQueryBuilder('i');

    const categoria = this.categoriaOuErro(categoriaRaw);
    if (categoria) {
      qb.andWhere('i.categoria = :categoria', { categoria });
    }

    const term = typeof q === 'string' ? q.trim() : '';
    if (term) {
      qb
        .andWhere(
          new Brackets((where) => {
            SEARCH_FIELDS.forEach((field, index) => {
              // busca() = função SQL registrada no database module (sem acento e sem caixa)
              const clause = `busca(i.${field}) LIKE busca(:q) ESCAPE '\\'`;
              if (index === 0) where.where(clause);
              else where.orWhere(clause);
            });
          }),
        )
        .setParameter('q', `%${likeTerm(term)}%`);
    }

    qb.orderBy('i.nome', 'ASC').addOrderBy('i.id', 'DESC');
    return qb.getMany();
  }

  async sugestoes(
    termoRaw?: string,
    campoRaw?: string,
    categoriaRaw?: string,
  ): Promise<Sugestao[]> {
    const termo =
      typeof termoRaw === 'string' ? termoRaw.trim().slice(0, 100) : '';
    if (termo.length < 2) return [];

    const campo =
      typeof campoRaw === 'string' && campoRaw.trim().toLowerCase() === 'localizacao'
        ? 'localizacao'
        : 'nome';
    const coluna = campo === 'nome' ? 'i.nome' : 'i.localizacao';

    const catRaw = typeof categoriaRaw === 'string' ? categoriaRaw.trim() : '';
    const prioridade = catRaw ? (findCategory(catRaw, CATEGORIES) ?? null) : null;

    const like = `%${likeTerm(termo)}%`;
    const prefixo = `${likeTerm(termo)}%`;

    const qb = this.itens
      .createQueryBuilder('i')
      .select('MAX(i.id)', 'ultimoId')
      .addSelect('i.categoria', 'categoria')
      .addSelect('COUNT(*)', 'total')
      .where(`busca(${coluna}) LIKE busca(:like) ESCAPE '\\'`, { like })
      .groupBy(`busca(${coluna})`)
      .addGroupBy('i.categoria')
      .take(8);

    if (campo === 'localizacao') qb.andWhere("i.localizacao <> ''");

    if (prioridade) {
      qb
        .orderBy('CASE WHEN i.categoria = :prioridade THEN 0 ELSE 1 END')
        .addOrderBy(
          `CASE WHEN busca(${coluna}) LIKE busca(:prefixo) ESCAPE '\\' THEN 0 ELSE 1 END`,
        )
        .addOrderBy('ultimoId', 'DESC')
        .setParameter('prioridade', prioridade);
    } else {
      qb
        .orderBy(
          `CASE WHEN busca(${coluna}) LIKE busca(:prefixo) ESCAPE '\\' THEN 0 ELSE 1 END`,
        )
        .addOrderBy('ultimoId', 'DESC');
    }
    qb.setParameter('prefixo', prefixo);

    const grupos: Array<{ ultimoId: string; categoria: string; total: string }> =
      await qb.getRawMany();
    if (grupos.length === 0) return [];

    const ids = grupos.map((g) => Number(g.ultimoId));
    const recentes = await this.itens.findBy({ id: In(ids) });
    const porId = new Map(recentes.map((item) => [item.id, item]));

    return grupos.flatMap((g) => {
      const item = porId.get(Number(g.ultimoId));
      if (!item) return [];
      const valor = campo === 'nome' ? item.nome : item.localizacao;
      if (!valor) return [];
      return [
        { valor, categoria: g.categoria, repeticoes: Number(g.total) || 1 },
      ];
    });
  }

  async resumo(): Promise<{
    porSecao: Record<string, { itens: number; unidades: number }>;
    total: number;
    unidades: number;
  }> {
    const rows: Array<{
      categoria: string;
      total: string;
      unidades: string | null;
    }> = await this.itens
      .createQueryBuilder('i')
      .select('i.categoria', 'categoria')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(i.quantidade)', 'unidades')
      .groupBy('i.categoria')
      .getRawMany();

    const porSecao: Record<string, { itens: number; unidades: number }> = {};
    for (const categoria of CATEGORIES)
      porSecao[categoria] = { itens: 0, unidades: 0 };
    for (const row of rows) {
      if (row.categoria in porSecao) {
        porSecao[row.categoria] = {
          itens: Number(row.total) || 0,
          unidades: Number(row.unidades) || 0,
        };
      }
    }

    const total = Object.values(porSecao).reduce((acc, v) => acc + v.itens, 0);
    const unidades = Object.values(porSecao).reduce(
      (acc, v) => acc + v.unidades,
      0,
    );
    return { porSecao, total, unidades };
  }

  async buscarPorId(id: number): Promise<Item> {
    const item = await this.itens.findOneBy({ id });
    if (!item) throw new NotFoundException('Item não encontrado.');
    return item;
  }

  async criar(dto: CriarItemDto, username: string): Promise<Item> {
    const item = await this.itens.save(
      this.itens.create({
        nome: dto.nome,
        categoria: dto.categoria as Item['categoria'],
        quantidade: dto.quantidade ?? 1,
        localizacao: dto.localizacao ?? '',
        serial: dto.serial ?? '',
        patrimonio: dto.patrimonio ?? '',
        danificado: dto.danificado ?? false,
        atribuicao: dto.atribuicao ?? '',
        observacao: dto.observacao ?? '',
      }),
    );
    await this.logs.registrar(
      'item.criar',
      `#${item.id} "${item.nome}" em ${item.categoria} (qtd ${item.quantidade}).`,
      username,
    );
    return item;
  }

  async atualizar(
    id: number,
    dto: AtualizarItemDto,
    username: string,
  ): Promise<Item> {
    const item = await this.itens.findOneBy({ id });
    if (!item) throw new NotFoundException('Item não encontrado.');
    Object.assign(item, {
      nome: dto.nome,
      categoria: dto.categoria,
      quantidade: dto.quantidade ?? 1,
      localizacao: dto.localizacao ?? '',
      serial: dto.serial ?? '',
      patrimonio: dto.patrimonio ?? '',
      danificado: dto.danificado ?? false,
      atribuicao: dto.atribuicao ?? '',
      observacao: dto.observacao ?? '',
    });
    const saved = await this.itens.save(item);
    await this.logs.registrar(
      'item.editar',
      `#${saved.id} "${saved.nome}" em ${saved.categoria} (qtd ${saved.quantidade}).`,
      username,
    );
    return saved;
  }

  async excluir(id: number, username: string): Promise<void> {
    const alvo = await this.itens.findOneBy({ id });
    if (!alvo) throw new NotFoundException('Item não encontrado.');
    await this.itens.delete({ id });
    await this.logs.registrar(
      'item.excluir',
      `#${id} "${alvo.nome}" removido de ${alvo.categoria}.`,
      username,
    );
  }
}
