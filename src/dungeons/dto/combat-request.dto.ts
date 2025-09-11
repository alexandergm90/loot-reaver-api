import { IsString, IsNumber, IsPositive, Min } from 'class-validator';

export class CombatRequestDto {
  @IsString()
  dungeonId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  level: number;
}

