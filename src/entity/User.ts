import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("usuarios")
export class User {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 60 })
  username!: string;

  @Column({ type: "varchar", length: 100, name: "senha_hash" })
  senhaHash!: string;

  @CreateDateColumn({ name: "criado_em" })
  criadoEm!: Date;
}
