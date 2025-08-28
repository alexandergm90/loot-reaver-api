import { IsOptional, IsString } from 'class-validator';

export class EquipItemDto {
  @IsString()
  itemId!: string;

  @IsOptional()
  @IsString()
  slot?: string;
}


