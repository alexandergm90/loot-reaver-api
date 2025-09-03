import { IsString, IsNumber, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScaledEnemyDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsNumber()
  baseHp: number;

  @IsNumber()
  baseAtk: number;

  @IsNumber()
  scaledHp: number;

  @IsNumber()
  scaledAtk: number;

  @IsNumber()
  scaledDef: number;
}

export class ScaledWaveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  enemies: Array<{
    enemy: ScaledEnemyDto;
    count: number;
  }>;
}

export class ScaledRewardDto {
  @IsNumber()
  goldMin: number;

  @IsNumber()
  goldMax: number;

  @IsNumber()
  xpMin: number;

  @IsNumber()
  xpMax: number;

  @IsOptional()
  dropsJson?: any;
}

export class DungeonDetailsResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  level: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScaledWaveDto)
  waves: ScaledWaveDto[];

  @ValidateNested()
  @Type(() => ScaledRewardDto)
  rewards: ScaledRewardDto;

  @IsOptional()
  @IsNumber()
  requiredItemPower?: number;
}

