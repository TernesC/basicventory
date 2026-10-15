import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Seções (categorias) do inventário. */
export const CATEGORIES = [
  'Notebooks',
  'Desktops',
  'Celulares',
  'Periféricos',
  'Outros',
  'Descarte',
] as const;

export type Category = (typeof CATEGORIES)[number];

@Entity('itens')
export class Item {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  categoria: Category;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'integer', default: 1 })
  quantidade: number;

  @Column({ type: 'varchar', length: 150, default: '' })
  localizacao: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  serial: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  patrimonio: string;

  @Column({ type: 'boolean', default: false })
  danificado: boolean;

  @Column({ type: 'varchar', length: 150, default: '' })
  atribuicao: string;

  @Column({ type: 'text', default: '' })
  observacao: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
