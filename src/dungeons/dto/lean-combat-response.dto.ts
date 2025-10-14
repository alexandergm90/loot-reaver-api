import { IsString, IsNumber, IsArray, IsBoolean, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// Actor information with status tracking
export class LeanActorDto {
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
  startHp: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusEffectDto)
  statuses: StatusEffectDto[];
}

export class StatusEffectDto {
  @IsString()
  id: string;

  @IsNumber()
  stacks: number;

  @IsNumber()
  duration: number;
}

// Action result for a single target
export class ActionResultDto {
  @IsString()
  targetId: string;

  @IsNumber()
  amount: number;

  @IsBoolean()
  crit: boolean;

  @IsNumber()
  hpBefore: number;

  @IsNumber()
  hpAfter: number;

  @IsBoolean()
  kill: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusEffectDto)
  statusApplied?: StatusEffectDto[];
}

// Single action frame with consolidated results
export class ActionFrameDto {
  @IsEnum(['action'])
  type: 'action';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionResultDto)
  results: ActionResultDto[];
}

// Status tick information
export class StatusTickDto {
  @IsString()
  status: string;

  @IsString()
  targetId: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  hpBefore: number;

  @IsNumber()
  hpAfter: number;

  @IsNumber()
  stacksBefore: number;

  @IsNumber()
  durationAfter: number;

  @IsBoolean()
  expired: boolean;

  @IsBoolean()
  lethal: boolean;
}

// Round end frame with status ticks
export class RoundEndFrameDto {
  @IsEnum(['round_end'])
  type: 'round_end';

  @IsNumber()
  roundNumber: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusTickDto)
  statusTicks?: StatusTickDto[];
}

// Death frame
export class DeathFrameDto {
  @IsEnum(['death'])
  type: 'death';

  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @IsString()
  cause: string;
}

// End battle frame
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

// Union type for all end frame types
export type LeanEndFrameDto = RoundEndFrameDto | DeathFrameDto | EndBattleFrameDto;

// Action with lean frames
export class LeanActionDto {
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
  @Type(() => ActionFrameDto)
  frames: ActionFrameDto[];
}

// Round with lean actions and end frames
export class LeanRoundDto {
  @IsNumber()
  roundNumber: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeanActionDto)
  actions: LeanActionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  endFrames: LeanEndFrameDto[];
}

// Main lean combat result
export class LeanCombatResultDto {
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
  @Type(() => LeanActorDto)
  actors: LeanActorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeanRoundDto)
  rounds: LeanRoundDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsDto)
  rewards?: RewardsDto;
}

