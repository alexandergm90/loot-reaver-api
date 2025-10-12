// Status effect system for frame-based combat
export interface StatusEffect {
  id: string;
  stacks: number;
  duration: number;
}

export interface CombatEntity {
  id: string;
  name: string;
  code?: string;
  currentHp: number;
  maxHp: number;
  damage: number;
  isPlayer: boolean;
  isAlive: boolean;
  statusEffects: Map<string, StatusEffect>;
}

export interface CombatFrame {
  type: 'attack' | 'damage' | 'status_apply' | 'death' | 'status_tick' | 'status_update' | 'status_cleanup' | 'end_round' | 'end_battle';
  [key: string]: any;
}

export interface CombatAction {
  actionId: string;
  actorId: string;
  ability: string;
  element: string;
  targets: string[];
  tags: string[];
  frames: CombatFrame[];
}

export interface CombatRound {
  roundNumber: number;
  actions: CombatAction[];
  endFrames: CombatFrame[];
}

export interface FrameCombatResult {
  version: string;
  logId: string;
  tickPolicy: string;
  outcome: 'victory' | 'defeat';
  totalRounds: number;
  actors: Array<{
    id: string;
    name: string;
    code?: string;
    isPlayer: boolean;
    maxHp: number;
    hp: number;
  }>;
  rounds: CombatRound[];
  rewards?: {
    gold: number;
    xp: number;
    items?: any[];
  };
}

