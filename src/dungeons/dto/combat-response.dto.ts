import { IsString, IsNumber, IsArray, IsBoolean, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CombatEntityDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsNumber()
  currentHp: number;

  @IsNumber()
  maxHp: number;

  @IsNumber()
  damage: number;

  @IsBoolean()
  isPlayer: boolean;
}

export class CombatActionDto {
  @IsString()
  attackerId: string;

  @IsString()
  targetId: string;

  @IsNumber()
  damage: number;

  @IsString()
  actionType: 'attack' | 'defend' | 'special';

  // Animation and FX tracking fields
  @IsString()
  actionId: string;

  @IsString()
  ability: string;

  @IsOptional()
  @IsBoolean()
  crit?: boolean;

  @IsOptional()
  @IsBoolean()
  miss?: boolean;

  @IsOptional()
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statusApplied?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // HP tracking for precise animation timing
  @IsNumber()
  targetHpBefore: number;

  @IsNumber()
  targetHpAfter: number;

  @IsOptional()
  @IsBoolean()
  kill?: boolean;
}

export class CombatRoundDto {
  @IsNumber()
  roundNumber: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatActionDto)
  actions: CombatActionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatEntityDto)
  entities: CombatEntityDto[];
}

export class CombatResultDto {
  @IsString()
  outcome: 'victory' | 'defeat';

  @IsNumber()
  totalRounds: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatRoundDto)
  rounds: CombatRoundDto[];

  @IsOptional()
  rewards?: {
    gold: number;
    xp: number;
    items?: any[];
  };
}
