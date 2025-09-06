import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DungeonDetailsQueryDto {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  level: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  itemPower?: number;
}


