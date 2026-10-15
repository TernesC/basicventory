import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsModule } from '../logs/logs.module';
import { AuthController, UsuariosController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from './user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    LogsModule,
    JwtModule.register({
      global: true,
      secret:
        process.env.JWT_SECRET ||
        'inventario-dev-secret-troque-em-producao',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRACAO ||
          '12h') as unknown as number & string,
      },
    }),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
