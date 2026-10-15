import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestApplication, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as path from 'node:path';
import { AppModule, frontendDist } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  // Sem segredo de verdade, sem boot em produção: impede que a imagem rode
  // com o segredo de desenvolvimento (todos os deploys partilhariam a
  // mesma chave). Em dev (NODE_ENV ausente) o fallback do AuthModule vale.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido. Defina a variável de ambiente JWT_SECRET.');
  }
  const app = await NestFactory.create<NestApplication>(AppModule, { cors: true });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const messages = [
          ...new Set(
            errors.flatMap((e) =>
              e.constraints ? Object.values(e.constraints) : [],
            ),
          ),
        ];
        return new BadRequestException(
          messages.length > 0 ? messages.join(' ') : 'Dados inválidos.',
        );
      },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Inventário · Gestão de Equipamentos')
    .setDescription(
      'API do inventário: itens, usuários, autenticação JWT e logs de auditoria.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // Caminho literal (o setup do Swagger não herda o prefixo global).
  SwaggerModule.setup('api/docs', app, document);

  // SPA Angular: estáticos primeiro, fallback (index.html) depois.
  // A ordem é registrada aqui de propósito via adapter (imediato): o
  // ServeStaticModule registra no onModuleInit — que roda dentro do
  // app.listen(), DEPOIS deste ponto — e perderia para o fallback,
  // devolvendo index.html até para os .js/.css (página em branco).
  const dist = frontendDist();
  if (dist) {
    app.useStaticAssets(dist);
    const server = app.getHttpAdapter().getInstance();
    // Sintaxe path-to-regexp v8 (o '*' sozinho é inválido).
    server.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Inventário (NestJS) rodando em http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger em http://localhost:${port}/api/docs`);
}

void bootstrap();
