import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsModule } from '../logs/logs.module';
import { Item } from './item.entity';
import { ItensController, ResumoController } from './itens.controller';
import { ItensService } from './itens.service';

@Module({
  imports: [TypeOrmModule.forFeature([Item]), LogsModule],
  controllers: [ItensController, ResumoController],
  providers: [ItensService],
})
export class ItensModule {}
