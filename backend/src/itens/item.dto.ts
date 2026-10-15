import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CATEGORIES } from './item.entity';
import { normalizeSearch } from '../common/search.util';

const SECAO_MSG = `Seção inválida. Use uma destas: ${CATEGORIES.join(', ')}.`;

const toTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Normaliza a seção ignorando acento/caixa ("perifericos" -> "Periféricos"). */
const toCategoria = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const target = normalizeSearch(value);
  return (
    CATEGORIES.find((c) => normalizeSearch(c) === target) ?? value.trim()
  );
};

/** "" / null / undefined viram 1 (padrão do formulário). */
const toQuantidade = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) return 1;
  const n = Number(value);
  return Number.isNaN(n) ? value : n;
};

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['true', '1', 'sim', 's', 'yes', 'y'].includes(
      value.trim().toLowerCase(),
    );
  }
  return value;
};

export class CriarItemDto {
  @ApiProperty({ example: 'Notebooks', enum: CATEGORIES })
  @IsIn([...CATEGORIES], { message: SECAO_MSG })
  @Transform(toCategoria)
  @IsString({ message: SECAO_MSG })
  categoria: string;

  @ApiProperty({ example: 'Dell Latitude 5540' })
  @IsString({ message: 'Nome do Item é obrigatório.' })
  @MinLength(1, { message: 'Nome do Item é obrigatório.' })
  @MaxLength(150, { message: 'Nome do Item deve ter até 150 caracteres.' })
  @Transform(toTrimmed)
  nome: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(toQuantidade)
  @IsInt({ message: 'Quantidade deve ser um número inteiro maior ou igual a zero.' })
  @Min(0, {
    message: 'Quantidade deve ser um número inteiro maior ou igual a zero.',
  })
  @Max(100000, { message: 'Quantidade não pode passar de 100000.' })
  quantidade?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Localização inválida.' })
  @MaxLength(150, { message: 'Localização deve ter até 150 caracteres.' })
  @Transform(toTrimmed)
  localizacao?: string = '';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Serial inválido.' })
  @MaxLength(100, { message: 'Serial deve ter até 100 caracteres.' })
  @Transform(toTrimmed)
  serial?: string = '';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Patrimônio inválido.' })
  @MaxLength(100, { message: 'Patrimônio deve ter até 100 caracteres.' })
  @Transform(toTrimmed)
  patrimonio?: string = '';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Danificado deve ser verdadeiro ou falso.' })
  @Transform(toBoolean)
  danificado?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Atribuição inválida.' })
  @MaxLength(150, { message: 'Atribuição deve ter até 150 caracteres.' })
  @Transform(toTrimmed)
  atribuicao?: string = '';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Observação inválida.' })
  @MaxLength(2000, { message: 'Observação deve ter até 2000 caracteres.' })
  @Transform(toTrimmed)
  observacao?: string = '';
}

export class AtualizarItemDto extends CriarItemDto {}
