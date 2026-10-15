import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { LogsService } from '../logs/logs.service';
import { User } from './user.entity';

const ADMIN_PADRAO = { username: 'admin', senha: 'admin123' };

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly logs: LogsService,
  ) {}

  /** Cria o usuário admin inicial quando o banco ainda não tem usuários. */
  async onModuleInit(): Promise<void> {
    const total = await this.users.count();
    if (total > 0) return;
    await this.users.save(
      this.users.create({
        username: ADMIN_PADRAO.username,
        senhaHash: await bcrypt.hash(ADMIN_PADRAO.senha, 10),
      }),
    );
    await this.logs.registrar(
      'sistema',
      `Usuário inicial "${ADMIN_PADRAO.username}" criado.`,
      'sistema',
    );
    // eslint-disable-next-line no-console
    console.log(
      `Usuário inicial criado -> login: ${ADMIN_PADRAO.username} | senha: ${ADMIN_PADRAO.senha} (troque criando outro usuário e excluindo este, se desejar)`,
    );
  }

  async validarLogin(
    usernameRaw: unknown,
    senhaRaw: unknown,
  ): Promise<{ token: string; usuario: { id: number; username: string } }> {
    const nome = typeof usernameRaw === 'string' ? usernameRaw.trim() : '';
    const senha = typeof senhaRaw === 'string' ? senhaRaw : '';
    if (!nome || !senha) {
      throw new BadRequestException('Informe usuário e senha.');
    }

    const usuario = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:nome)', { nome })
      .getOne();

    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      await this.logs.registrar(
        'login.falha',
        `Tentativa de login para "${nome.slice(0, 60)}".`,
        nome,
      );
      throw new UnauthorizedException('Usuário ou senha inválidos.');
    }

    const token = await this.jwt.signAsync({
      sub: usuario.id,
      username: usuario.username,
    });
    await this.logs.registrar('login', 'Login realizado.', usuario.username);
    return {
      token,
      usuario: { id: usuario.id, username: usuario.username },
    };
  }
}
