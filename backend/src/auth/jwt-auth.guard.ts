import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from '../common/current-user.decorator';

interface TokenPayload {
  sub: number;
  username: string;
}

/** Exige `Authorization: Bearer <token>`. Responde 401 quando ausente/inválido. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { usuario?: AuthUser }>();
    const header = req.headers.authorization || '';
    const [esquema, token] = header.split(' ');
    if (esquema !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Sessão expirada ou inexistente. Faça login novamente.',
      );
    }
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token);
      req.usuario = { id: payload.sub, username: payload.username };
      return true;
    } catch {
      throw new UnauthorizedException(
        'Sessão expirada ou inválida. Faça login novamente.',
      );
    }
  }
}
