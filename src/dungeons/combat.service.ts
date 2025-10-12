import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { 
  FrameCombatResultDto, 
  CombatRoundDto, 
  CombatActionDto, 
  CombatFrameDto,
  CombatActorDto 
} from './dto/frame-combat-response.dto';
import { CombatEntity, CombatFrame, CombatAction, CombatRound, StatusEffect } from './types/combat.types';

@Injectable()
export class CombatService {
  constructor(private readonly prisma: PrismaService) {}

  async runCombat(
    dungeonId: string,
    level: number,
    characterId: string,
  ): Promise<FrameCombatResultDto> {
    // Get dungeon and validate level access
    const dungeon = await this.prisma.dungeon.findUnique({
      where: { id: dungeonId },
      include: {
        scaling: true,
        rewards: true,
        progress: {
          where: { characterId },
        },
      },
    });

    if (!dungeon) {
      throw new NotFoundException('Dungeon not found');
    }

    // Validate level access
    const highestLevelCleared = dungeon.progress[0]?.highestLevelCleared || 0;
    if (level > highestLevelCleared + 1) {
      throw new BadRequestException('Level not available. You can only access levels up to ' + (highestLevelCleared + 1));
    }

    // Get character stats
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        items: { where: { equipped: true }, include: { template: true } },
      },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    // Calculate player stats (base stats + equipment)
    const playerStats = this.calculatePlayerStats(character.items);
    
    // Get enemy data for the specific level
    const enemyData = await this.getEnemyDataForLevel(dungeon, level);
    
    // Initialize combat entities
    const entities: CombatEntity[] = [
      {
        id: character.id,
        name: character.name,
        currentHp: playerStats.hp,
        maxHp: playerStats.hp,
        damage: playerStats.damage,
        isPlayer: true,
        isAlive: true,
        statusEffects: new Map(),
      },
      ...enemyData.map((enemy, index) => ({
        id: `enemy_${enemy.id}_${index}`,
        name: enemy.name,
        code: enemy.code,
        currentHp: enemy.scaledHp,
        maxHp: enemy.scaledHp,
        damage: enemy.scaledAtk,
        isPlayer: false,
        isAlive: true,
        statusEffects: new Map(),
      })),
    ];

    // Store initial HP values for actors display
    const initialActorData = entities.map(e => ({
      id: e.id,
      name: e.name,
      code: e.code,
      isPlayer: e.isPlayer,
      maxHp: e.maxHp,
      initialHp: e.currentHp,
    }));

    // Run combat simulation
    const rounds: CombatRoundDto[] = [];
    let roundNumber = 1;
    const maxRounds = 50; // Prevent infinite loops
    const logId = `run_${Date.now()}`;

    while (roundNumber <= maxRounds) {
      const round = this.simulateFrameRound(entities, roundNumber, logId);
      rounds.push(round);

      // Check if combat is over
      const player = entities.find(e => e.isPlayer);
      const aliveEnemies = entities.filter(e => !e.isPlayer && e.isAlive);

      if (!player?.isAlive) {
        // Player defeated
        const result = this.createFrameCombatResult('defeat', roundNumber, rounds, logId, initialActorData);
        return result;
      }

      if (aliveEnemies.length === 0) {
        // All enemies defeated - victory
        const rewards = this.calculateRewards(dungeon, level);
        const result = this.createFrameCombatResult('victory', roundNumber, rounds, logId, initialActorData, rewards);
        return result;
      }

      roundNumber++;
    }

    // Combat timeout (shouldn't happen with reasonable stats)
    const result = this.createFrameCombatResult('defeat', maxRounds, rounds, logId, initialActorData);
    return result;
  }

  private calculatePlayerStats(equippedItems: any[]): { hp: number; damage: number } {
    // Base player stats
    let hp = 20;
    let damage = 5;

    // Add equipment bonuses
    for (const item of equippedItems) {
      const baseStats = item.template?.baseStats || {};
      const bonuses = item.bonuses || {};
      
      if (typeof baseStats.hp === 'number') hp += baseStats.hp;
      if (typeof baseStats.damage === 'number') damage += baseStats.damage;
      if (typeof bonuses.hp === 'number') hp += bonuses.hp;
      if (typeof bonuses.damage === 'number') damage += bonuses.damage;
    }

    return { hp, damage };
  }

  private async getEnemyDataForLevel(dungeon: any, level: number) {
    const waveComp = dungeon.waveComp as any[];
    const enemyIds = new Set<string>();
    
    // Get all enemy IDs from all waves
    waveComp.forEach((wave) => {
      wave.enemies.forEach((enemyRef: any) => {
        enemyIds.add(enemyRef.id);
      });
    });

    // Fetch enemy data
    const enemies = await this.prisma.enemy.findMany({
      where: { id: { in: Array.from(enemyIds) } },
    });

    const enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    const scaling = dungeon.scaling;

    // For now, we'll use the first wave for combat
    // In a more complex system, you might want to handle multiple waves
    const firstWave = waveComp[0];
    if (!firstWave) {
      throw new BadRequestException('Dungeon has no waves');
    }

    return firstWave.enemies.map((enemyRef: any) => {
      const enemy = enemyMap.get(enemyRef.id);
      if (!enemy) {
        throw new Error(`Enemy with id ${enemyRef.id} not found`);
      }

      const scaledHp = Math.floor(enemy.hp * (1 + (scaling?.hpGrowth || 0) * level));
      const scaledAtk = Math.floor(enemy.atk * (1 + (scaling?.atkGrowth || 0) * level));

      return {
        id: enemy.id,
        name: enemy.name,
        code: enemy.code,
        scaledHp,
        scaledAtk,
      };
    });
  }

  private simulateFrameRound(entities: CombatEntity[], roundNumber: number, logId: string): CombatRoundDto {
    const actions: CombatActionDto[] = [];
    const aliveEntities = entities.filter(e => e.isAlive);

    // Player always attacks first
    const player = aliveEntities.find(e => e.isPlayer);
    const enemies = aliveEntities.filter(e => !e.isPlayer);

    if (player && enemies.length > 0) {
      const playerAction = this.createPlayerAction(player, enemies[0], roundNumber, logId);
      actions.push(playerAction);
      
      // Apply the action effects
      this.applyActionEffects(playerAction, entities);
    }

    // Only one enemy attacks back (the first alive enemy)
    const aliveEnemies = entities.filter(e => !e.isPlayer && e.isAlive);
    if (player && player.isAlive && aliveEnemies.length > 0) {
      const enemyAction = this.createEnemyAction(aliveEnemies[0], player, roundNumber, logId);
      actions.push(enemyAction);
      
      // Apply the action effects
      this.applyActionEffects(enemyAction, entities);
    }

    // Generate end frames for this round
    const endFrames = this.generateEndFrames(entities, roundNumber);

    return {
      roundNumber,
      actions,
      endFrames,
    };
  }

  private createPlayerAction(attacker: CombatEntity, target: CombatEntity, roundNumber: number, logId: string): CombatActionDto {
    const actionId = `player_attack_${roundNumber}_${logId}`;
    const frames: CombatFrameDto[] = [];
    
    // Attack frame
    frames.push({ type: 'attack' });
    
    // Damage frame
    const hpBefore = target.currentHp;
    const damage = this.calculateDamage(attacker.damage, target);
    const hpAfter = Math.max(0, hpBefore - damage);
    const isKill = hpAfter <= 0;
    
    frames.push({
      type: 'damage',
      amount: damage,
      crit: false,
      hpBefore: { [target.id]: hpBefore },
      hpAfter: { [target.id]: hpAfter },
      kill: isKill,
    });
    
    // Apply status effect (bleed for now)
    if (Math.random() < 0.3) { // 30% chance to apply bleed
      frames.push({
        type: 'status_apply',
        targetId: target.id,
        status: { id: 'bleed', stacks: 1, duration: 2 },
      });
    }
    
    // Death frame if killed
    if (isKill) {
      frames.push({
        type: 'death',
        targets: [target.id],
        cause: 'basic_slash',
      });
    }
    
    return {
      actionId,
      actorId: attacker.id,
      ability: 'basic_slash',
      element: 'physical',
      targets: [target.id],
      tags: ['melee', 'physical', 'player'],
      frames,
    };
  }

  private createEnemyAction(attacker: CombatEntity, target: CombatEntity, roundNumber: number, logId: string): CombatActionDto {
    const actionId = `enemy_attack_${roundNumber}_${logId}`;
    const frames: CombatFrameDto[] = [];
    
    // Attack frame
    frames.push({ type: 'attack' });
    
    // Damage frame
    const hpBefore = target.currentHp;
    const damage = this.calculateDamage(attacker.damage, target);
    const hpAfter = Math.max(0, hpBefore - damage);
    const isKill = hpAfter <= 0;
    
    frames.push({
      type: 'damage',
      amount: damage,
      crit: false,
      hpBefore: { [target.id]: hpBefore },
      hpAfter: { [target.id]: hpAfter },
      kill: isKill,
    });
    
    // Death frame if killed
    if (isKill) {
      frames.push({
        type: 'death',
        targets: [target.id],
        cause: 'basic_claw',
      });
    }
    
    return {
      actionId,
      actorId: attacker.id,
      ability: 'basic_claw',
      element: 'physical',
      targets: [target.id],
      tags: ['melee', 'physical', 'enemy'],
      frames,
    };
  }

  private applyActionEffects(action: CombatActionDto, entities: CombatEntity[]): void {
    // Find damage frame and apply HP changes
    const damageFrame = action.frames.find(f => f.type === 'damage');
    if (damageFrame) {
      const hpAfter = damageFrame.hpAfter as Record<string, number>;
      Object.entries(hpAfter).forEach(([targetId, newHp]) => {
        const entity = entities.find(e => e.id === targetId);
        if (entity) {
          entity.currentHp = newHp;
          if (newHp <= 0) {
            entity.isAlive = false;
          }
        }
      });
    }
    
    // Apply status effects
    action.frames.forEach(frame => {
      if (frame.type === 'status_apply') {
        const target = entities.find(e => e.id === frame.targetId);
        if (target) {
          const status = frame.status as StatusEffect;
          target.statusEffects.set(status.id, status);
        }
      }
    });
  }

  private generateEndFrames(entities: CombatEntity[], roundNumber: number): CombatFrameDto[] {
    const endFrames: CombatFrameDto[] = [];
    
    // Process status effects
    entities.forEach(entity => {
      if (entity.isAlive && entity.statusEffects.size > 0) {
        entity.statusEffects.forEach((status, statusId) => {
          // Status tick frame
          endFrames.push({
            type: 'status_tick',
            source: statusId,
            targets: [entity.id],
            amount: 0,
            note: status.duration === status.duration ? 'Newly applied this round → no tick yet.' : 'Status tick',
          });
          
          // Update status duration
          status.duration -= 1;
          
          // Status update frame
          endFrames.push({
            type: 'status_update',
            targetId: entity.id,
            status: { ...status },
          });
          
          // Remove expired status
          if (status.duration <= 0) {
            entity.statusEffects.delete(statusId);
          }
        });
      }
      
      // Cleanup statuses for dead entities
      if (!entity.isAlive && entity.statusEffects.size > 0) {
        endFrames.push({
          type: 'status_cleanup',
          targets: [entity.id],
          note: 'Target dead → remove statuses silently',
        });
        entity.statusEffects.clear();
      }
    });
    
    // End round frame
    endFrames.push({
      type: 'end_round',
      roundNumber,
    });
    
    return endFrames;
  }

  private createFrameCombatResult(
    outcome: 'victory' | 'defeat',
    totalRounds: number,
    rounds: CombatRoundDto[],
    logId: string,
    initialActorData: Array<{
      id: string;
      name: string;
      code?: string;
      isPlayer: boolean;
      maxHp: number;
      initialHp: number;
    }>,
    rewards?: { gold: number; xp: number; items?: any[] }
  ): FrameCombatResultDto {
    // Add end battle frame to last round
    if (rounds.length > 0) {
      const lastRound = rounds[rounds.length - 1];
      lastRound.endFrames.push({
        type: 'end_battle',
        outcome,
        rewards,
      });
    }
    
    return {
      version: 'v2-frames',
      logId,
      tickPolicy: 'end_of_round',
      outcome,
      totalRounds,
      actors: initialActorData.map(actor => ({
        id: actor.id,
        name: actor.name,
        code: actor.code,
        isPlayer: actor.isPlayer,
        maxHp: actor.maxHp,
        hp: actor.initialHp,
      })),
      rounds,
      rewards,
    };
  }

  private calculateDamage(attackerDamage: number, target: CombatEntity): number {
    // Simple damage calculation - in a more complex system you might have defense, crits, etc.
    return Math.max(1, attackerDamage);
  }

  private calculateRewards(dungeon: any, level: number) {
    const rewards = dungeon.rewards;
    const scaling = dungeon.scaling;
    
    if (!rewards) {
      return { gold: 0, xp: 0 };
    }

    const lootGrowth = scaling?.lootGrowth || 0;
    const goldMin = Math.floor(rewards.baseGoldMin * (1 + lootGrowth * level));
    const goldMax = Math.floor(rewards.baseGoldMax * (1 + lootGrowth * level));
    const xpMin = Math.floor(rewards.baseXpMin * (1 + lootGrowth * level));
    const xpMax = Math.floor(rewards.baseXpMax * (1 + lootGrowth * level));

    // Randomize rewards within range
    const gold = Math.floor(Math.random() * (goldMax - goldMin + 1)) + goldMin;
    const xp = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

    return { gold, xp };
  }
}

