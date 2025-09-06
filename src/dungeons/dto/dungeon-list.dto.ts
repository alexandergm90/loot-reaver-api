import { IsString, IsNumber } from 'class-validator';

export class DungeonListDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsNumber()
  highestLevelCleared: number;

  @IsNumber()
  availableLevels: number;
}
