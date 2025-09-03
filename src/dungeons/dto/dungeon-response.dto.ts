import { IsString, IsNumber, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EnemyDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsNumber()
  hp: number;

  @IsNumber()
  atk: number;
}

export class WaveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  enemies: Array<{
    id: string;
    count: number;
  }>;
}

export class DungeonScalingDto {
  @IsNumber()
  hpGrowth: number;

  @IsNumber()
  atkGrowth: number;

  @IsNumber()
  defGrowth: number;

  @IsOptional()
  @IsNumber()
  lootGrowth?: number;
}

export class DungeonRewardDto {
  @IsNumber()
  baseGoldMin: number;

  @IsNumber()
  baseGoldMax: number;

  @IsNumber()
  baseXpMin: number;

  @IsNumber()
  baseXpMax: number;

  @IsOptional()
  dropsJson?: any;
}

export class DungeonResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  wavesCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaveDto)
  waveComp: WaveDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DungeonScalingDto)
  scaling?: DungeonScalingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DungeonRewardDto)
  rewards?: DungeonRewardDto;

  @IsNumber()
  highestLevelCleared: number;

  @IsNumber()
  availableLevels: number;
}
