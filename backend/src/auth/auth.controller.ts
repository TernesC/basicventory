import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { LogsService } from '../logs/logs.service';
import { CriarUsuarioDto, LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from './user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly logs: LogsService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login { username, senha } → { token, usuario }' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Usuário ou senha inválidos.' })
  async login(@Body() body: LoginDto) {
    return this.auth.validarLogin(body.username, body.senha);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Dados do usuário logado' })
  async me(@CurrentUser() usuario: AuthUser) {
    return { usuario };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Registra saída (token descartado no cliente)',
  })
  async logout(@CurrentUser() usuario: AuthUser): Promise<void> {
    await this.logs.registrar(
      'logout',
      'Sessão encerrada.',
      usuario?.username ?? '',
    );
  }
}

@ApiTags('usuarios')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly logs: LogsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários (sem hash)' })
  async listar() {
    return this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.criadoEm'])
      .orderBy('u.username', 'ASC')
      .getMany();
  }

  @Post()
  @ApiOperation({ summary: 'Cria usuário { username, senha }' })
  @ApiResponse({ status: 201 })
  async criar(
    @Body() dto: CriarUsuarioDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    const username = dto.username.trim();
    // class-validator já valida formato; reforça trim vazio
    if (!username) {
      throw new BadRequestException(
        'Usuário deve ter de 3 a 60 caracteres (letras, números, ponto, _ ou -).',
      );
    }
    const existente = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:nome)', { nome: username })
      .getOne();
    if (existente) {
      throw new ConflictException('Esse nome de usuário já está em uso.');
    }
    const novo = await this.users.save(
      this.users.create({
        username,
        senhaHash: await bcrypt.hash(dto.senha, 10),
      }),
    );
    await this.logs.registrar(
      'usuario.criar',
      `Usuário "${novo.username}" criado.`,
      usuario?.username ?? '',
    );
    return { id: novo.id, username: novo.username, criadoEm: novo.criadoEm };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui usuário' })
  async excluir(
    @Param('id') idRaw: string,
    @CurrentUser() usuario: AuthUser,
  ): Promise<void> {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Identificador inválido.');
    }
    if (id === usuario?.id) {
      throw new BadRequestException(
        'Você não pode excluir o próprio usuário.',
      );
    }
    const alvo = await this.users.findOneBy({ id });
    if (!alvo) throw new NotFoundException('Usuário não encontrado.');
    const total = await this.users.count();
    if (total <= 1) {
      throw new BadRequestException(
        'Não é possível excluir o último usuário.',
      );
    }
    await this.users.delete({ id });
    await this.logs.registrar(
      'usuario.excluir',
      `Usuário "${alvo.username}" excluído.`,
      usuario?.username ?? '',
    );
  }
}
