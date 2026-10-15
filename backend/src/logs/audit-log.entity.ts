import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @CreateDateColumn({ name: 'criado_em' })
  @Index()
  criadoEm: Date;

  @Column({ type: 'varchar', length: 60, default: '' })
  usuario: string;

  @Column({ type: 'varchar', length: 60 })
  acao: string;

  @Column({ type: 'text', default: '' })
  detalhes: string;
}
