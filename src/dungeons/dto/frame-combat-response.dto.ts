import { IsString, IsNumber, IsArray, IsBoolean, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// Actor information
export class CombatActorDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsBoolean()
  isPlayer: boolean;

  @IsNumber()
  maxHp: number;

  @IsNumber()
  hp: number;
}

// Frame types
export class AttackFrameDto {
  @IsEnum(['attack'])
  type: 'attack';
}

export class DamageFrameDto {
  @IsEnum(['damage'])
  type: 'damage';

  @IsNumber()
  amount: number;

  @IsBoolean()
  crit: boolean;

  @IsArray()
  @IsString({ each: true })
  hpBefore: Record<string, number>;

  @IsArray()
  @IsString({ each: true })
  hpAfter: Record<string, number>;

  @IsBoolean()
  kill: boolean;
}

export class StatusApplyFrameDto {
  @IsEnum(['status_apply'])
  type: 'status_apply';

  @IsString()
  targetId: string;

  @ValidateNested()
  @Type(() => StatusEffectDto)
  status: StatusEffectDto;
}

export class StatusEffectDto {
  @IsString()
  id: string;

  @IsNumber()
  stacks: number;

  @IsNumber()
  duration: number;
}

export class DeathFrameDto {
  @IsEnum(['death'])
  type: 'death';

  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @IsString()
  cause: string;
}

export class StatusTickFrameDto {
  @IsEnum(['status_tick'])
  type: 'status_tick';

  @IsString()
  source: string;

  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class StatusUpdateFrameDto {
  @IsEnum(['status_update'])
  type: 'status_update';

  @IsString()
  targetId: string;

  @ValidateNested()
  @Type(() => StatusEffectDto)
  status: StatusEffectDto;
}

export class StatusCleanupFrameDto {
  @IsEnum(['status_cleanup'])
  type: 'status_cleanup';

  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @IsOptional()
  @IsString()
  note?: string;
}

export class EndRoundFrameDto {
  @IsEnum(['end_round'])
  type: 'end_round';

  @IsNumber()
  roundNumber: number;
}

export class EndBattleFrameDto {
  @IsEnum(['end_battle'])
  type: 'end_battle';

  @IsEnum(['victory', 'defeat'])
  outcome: 'victory' | 'defeat';

  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsDto)
  rewards?: RewardsDto;
}

export class RewardsDto {
  @IsNumber()
  gold: number;

  @IsNumber()
  xp: number;

  @IsOptional()
  @IsArray()
  items?: any[];
}

// Union type for all frame types
export type CombatFrameDto = 
  | AttackFrameDto 
  | DamageFrameDto 
  | StatusApplyFrameDto 
  | DeathFrameDto 
  | StatusTickFrameDto 
  | StatusUpdateFrameDto 
  | StatusCleanupFrameDto 
  | EndRoundFrameDto 
  | EndBattleFrameDto;

// Action with frames
export class CombatActionDto {
  @IsString()
  actionId: string;

  @IsString()
  actorId: string;

  @IsString()
  ability: string;

  @IsString()
  element: string;

  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  frames: CombatFrameDto[];
}

// Round with actions and end frames
export class CombatRoundDto {
  @IsNumber()
  roundNumber: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatActionDto)
  actions: CombatActionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  endFrames: CombatFrameDto[];
}

// Main combat result
export class FrameCombatResultDto {
  @IsString()
  version: string;

  @IsString()
  logId: string;

  @IsString()
  tickPolicy: string;

  @IsEnum(['victory', 'defeat'])
  outcome: 'victory' | 'defeat';

  @IsNumber()
  totalRounds: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatActorDto)
  actors: CombatActorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatRoundDto)
  rounds: CombatRoundDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsDto)
  rewards?: RewardsDto;
}

