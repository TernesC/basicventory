import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  senha: string;
}

export class CriarUsuarioDto {
  @ApiProperty({ example: 'maria' })
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,60}$/, {
    message:
      'Usuário deve ter de 3 a 60 caracteres (letras, números, ponto, _ ou -).',
  })
  username: string;

  @ApiProperty({ minLength: 4, maxLength: 100 })
  @IsString()
  @MinLength(4, { message: 'Senha deve ter de 4 a 100 caracteres.' })
  @MaxLength(100, { message: 'Senha deve ter de 4 a 100 caracteres.' })
  senha: string;
}
