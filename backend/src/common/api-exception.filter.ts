import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Garante o contrato de erro do frontend: sempre `{ erro: "mensagem" }`.
 * Preserva os status lançados (400/401/404/409) e mapeia o resto para 500.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as
        | string
        | { message?: string | string[]; erro?: string };
      let message: string;
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body?.erro === 'string' && body.erro) {
        message = body.erro;
      } else if (Array.isArray(body?.message)) {
        message = body.message.join(' ');
      } else if (typeof body?.message === 'string') {
        message = body.message;
      } else {
        message = exception.message || 'Erro na requisição.';
      }
      res.status(status).json({ erro: message });
      return;
    }

    if (exception instanceof SyntaxError) {
      res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
      return;
    }

    // eslint-disable-next-line no-console
    console.error(exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ erro: 'Erro interno no servidor.' });
  }
}
