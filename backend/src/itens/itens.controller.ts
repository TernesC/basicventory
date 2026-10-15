import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AtualizarItemDto, CriarItemDto } from './item.dto';
import { ItensService } from './itens.service';

/** Converte id da URL em número válido ou lança 400 (contrato do Express original). */
function readId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestException('Identificador inválido.');
  }
  return id;
}

@ApiTags('itens')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('itens')
export class ItensController {
  constructor(private readonly itens: ItensService) {}

  @Get('sugestoes')
  @ApiOperation({
    summary: 'Autocomplete agrupado (categoria só prioriza)',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'campo', required: false, example: 'nome' })
  @ApiQuery({ name: 'categoria', required: false })
  async sugestoes(
    @Query('q') q?: string,
    @Query('campo') campo?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.itens.sugestoes(q, campo, categoria);
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens da seção com busca' })
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'q', required: false })
  async listar(
    @Query('categoria') categoria?: string,
    @Query('q') q?: string,
  ) {
    return this.itens.listar(categoria, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta 1 item' })
  @ApiResponse({ status: 404, description: 'Item não encontrado.' })
  async buscarPorId(@Param('id') idRaw: string) {
    return this.itens.buscarPorId(readId(idRaw));
  }

  @Post()
  @ApiOperation({ summary: 'Cria item' })
  @ApiResponse({ status: 201 })
  async criar(
    @Body() dto: CriarItemDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.itens.criar(dto, usuario?.username ?? '');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza item' })
  async atualizar(
    @Param('id') idRaw: string,
    @Body() dto: AtualizarItemDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    const id = readId(idRaw);
    return this.itens.atualizar(id, dto, usuario?.username ?? '');
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui item' })
  async excluir(
    @Param('id') idRaw: string,
    @CurrentUser() usuario: AuthUser,
  ): Promise<void> {
    return this.itens.excluir(readId(idRaw), usuario?.username ?? '');
  }
}

@ApiTags('resumo')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('resumo')
export class ResumoController {
  constructor(private readonly itens: ItensService) {}

  @Get()
  @ApiOperation({ summary: 'Contagem de itens/unidades por seção' })
  async resumo() {
    return this.itens.resumo();
  }
}
