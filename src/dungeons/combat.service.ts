import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { 
  LeanCombatResultDto, 
  LeanRoundDto, 
  LeanActionDto, 
  LeanEndFrameDto,
  LeanActorDto,
  ActionFrameDto,
  ActionResultDto,
  StatusEffectDto,
  StatusTickDto,
  RoundEndFrameDto,
  DeathFrameDto,
  EndBattleFrameDto
} from './dto/lean-combat-response.dto';
import { CombatEntity, StatusEffect } from './types/combat.types';

@Injectable()
export class CombatService {
  constructor(private readonly prisma: PrismaService) {}

  async runCombat(
    dungeonId: string,
    level: number,
    characterId: string,
  ): Promise<LeanCombatResultDto> {
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

    // Store initial actor data for lean format
    const initialActorData: LeanActorDto[] = entities.map(e => ({
      id: e.id,
      name: e.name,
      code: e.code,
      isPlayer: e.isPlayer,
      maxHp: e.maxHp,
      startHp: e.currentHp,
      statuses: [],
    }));

    // Run combat simulation
    const rounds: LeanRoundDto[] = [];
    let roundNumber = 1;
    const maxRounds = 50; // Prevent infinite loops
    const logId = `run_${Date.now()}`;

    while (roundNumber <= maxRounds) {
      const round = this.simulateLeanRound(entities, roundNumber, logId, playerStats.attackType);
      rounds.push(round);

      // Check if combat is over
      const player = entities.find(e => e.isPlayer);
      const aliveEnemies = entities.filter(e => !e.isPlayer && e.isAlive);

      if (!player?.isAlive) {
        // Player defeated
        const result = this.createLeanCombatResult('defeat', roundNumber, rounds, logId, initialActorData);
        return result;
      }

      if (aliveEnemies.length === 0) {
        // All enemies defeated - victory
        const rewards = this.calculateRewards(dungeon, level);
        const result = this.createLeanCombatResult('victory', roundNumber, rounds, logId, initialActorData, rewards);
        return result;
      }

      roundNumber++;
    }

    // Combat timeout (shouldn't happen with reasonable stats)
    const result = this.createLeanCombatResult('defeat', maxRounds, rounds, logId, initialActorData);
    return result;
  }

  private calculatePlayerStats(equippedItems: any[]): { hp: number; damage: number; attackType: string } {
    // Base player stats
    let hp = 20;
    let damage = 5;
    let attackType = 'slashes';

    // Add equipment bonuses
    for (const item of equippedItems) {
      const baseStats = item.template?.baseStats || {};
      const bonuses = item.bonuses || {};
      
      if (typeof baseStats.hp === 'number') hp += baseStats.hp;
      if (typeof baseStats.damage === 'number') damage += baseStats.damage;
      if (typeof bonuses.hp === 'number') hp += bonuses.hp;
      if (typeof bonuses.damage === 'number') damage += bonuses.damage;
      if (typeof baseStats.attackType === 'string') attackType = baseStats.attackType;
    }

    return { hp, damage, attackType };
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

  private simulateLeanRound(entities: CombatEntity[], roundNumber: number, logId: string, playerAttackType: string): LeanRoundDto {
    const actions: LeanActionDto[] = [];
    const aliveEntities = entities.filter(e => e.isAlive);

    // Player always attacks first
    const player = aliveEntities.find(e => e.isPlayer);
    const enemies = aliveEntities.filter(e => !e.isPlayer);

    if (player && enemies.length > 0) {
      const playerAction = this.createLeanPlayerAction(player, enemies[0], roundNumber, logId, playerAttackType);
      actions.push(playerAction);
      
      // Apply the action effects
      this.applyLeanActionEffects(playerAction, entities);
    }

    // Only one enemy attacks back (the first alive enemy)
    const aliveEnemies = entities.filter(e => !e.isPlayer && e.isAlive);
    if (player && player.isAlive && aliveEnemies.length > 0) {
      const enemyAction = this.createLeanEnemyAction(aliveEnemies[0], player, roundNumber, logId);
      actions.push(enemyAction);
      
      // Apply the action effects
      this.applyLeanActionEffects(enemyAction, entities);
    }

    // Generate end frames for this round
    const endFrames = this.generateLeanEndFrames(entities, roundNumber);

    return {
      roundNumber,
      actions,
      endFrames,
    };
  }

  private createLeanPlayerAction(attacker: CombatEntity, target: CombatEntity, roundNumber: number, logId: string, playerAttackType: string): LeanActionDto {
    const actionId = `player_attack_${roundNumber}_${logId}`;
    
    // Calculate damage and effects
    const hpBefore = target.currentHp;
    const damage = this.calculateDamage(attacker.damage, target);
    const hpAfter = Math.max(0, hpBefore - damage);
    const isKill = hpAfter <= 0;
    
    // Check for status application
    const statusApplied: StatusEffectDto[] = [];
    if (Math.random() < 0.3) { // 30% chance to apply bleed
      statusApplied.push({ id: 'bleed', stacks: 1, duration: 2 });
    }
    
    // Create single action frame with consolidated results
    const actionFrame: ActionFrameDto = {
      type: 'action',
      results: [{
        targetId: target.id,
        amount: damage,
        crit: false,
        hpBefore,
        hpAfter,
        kill: isKill,
        statusApplied: statusApplied.length > 0 ? statusApplied : undefined,
      }],
    };
    
    return {
      actionId,
      actorId: attacker.id,
      ability: playerAttackType || 'slashes',
      element: 'physical',
      targets: [target.id],
      tags: ['melee', 'physical', 'player'],
      frames: [actionFrame],
    };
  }

  private createLeanEnemyAction(attacker: CombatEntity, target: CombatEntity, roundNumber: number, logId: string): LeanActionDto {
    const actionId = `enemy_attack_${roundNumber}_${logId}`;
    
    // Calculate damage
    const hpBefore = target.currentHp;
    const damage = this.calculateDamage(attacker.damage, target);
    const hpAfter = Math.max(0, hpBefore - damage);
    const isKill = hpAfter <= 0;
    
    // Create single action frame with consolidated results
    const actionFrame: ActionFrameDto = {
      type: 'action',
      results: [{
        targetId: target.id,
        amount: damage,
        crit: false,
        hpBefore,
        hpAfter,
        kill: isKill,
      }],
    };
    
    return {
      actionId,
      actorId: attacker.id,
      ability: 'slashes',
      element: 'physical',
      targets: [target.id],
      tags: ['melee', 'physical', 'enemy'],
      frames: [actionFrame],
    };
  }

  private applyLeanActionEffects(action: LeanActionDto, entities: CombatEntity[]): void {
    // Apply effects from the action frame
    action.frames.forEach(frame => {
      if (frame.type === 'action') {
        frame.results.forEach(result => {
          const entity = entities.find(e => e.id === result.targetId);
          if (entity) {
            // Apply HP changes
            entity.currentHp = result.hpAfter;
            if (result.hpAfter <= 0) {
              entity.isAlive = false;
            }
            
            // Apply status effects
            if (result.statusApplied) {
              result.statusApplied.forEach(status => {
                entity.statusEffects.set(status.id, {
                  id: status.id,
                  stacks: status.stacks,
                  duration: status.duration,
                });
              });
            }
          }
        });
      }
    });
  }

  private generateLeanEndFrames(entities: CombatEntity[], roundNumber: number): LeanEndFrameDto[] {
    const endFrames: LeanEndFrameDto[] = [];
    const statusTicks: StatusTickDto[] = [];
    const deathFrames: DeathFrameDto[] = [];
    
    // Process status effects
    entities.forEach(entity => {
      if (entity.isAlive && entity.statusEffects.size > 0) {
        entity.statusEffects.forEach((status, statusId) => {
          // Calculate status damage based on type
          let statusDamage = 0;
          
          if (statusId === 'bleed') {
            // Bleed deals 10% of max HP per tick
            statusDamage = Math.max(1, Math.floor(entity.maxHp * 0.1));
          }
          
          // Apply status damage if any
          if (statusDamage > 0) {
            const hpBefore = entity.currentHp;
            const hpAfter = Math.max(0, hpBefore - statusDamage);
            const isKill = hpAfter <= 0;
            const stacksBefore = status.stacks;
            const durationAfter = status.duration - 1;
            const expired = durationAfter <= 0;
            
            // Update entity HP
            entity.currentHp = hpAfter;
            if (hpAfter <= 0) {
              entity.isAlive = false;
            }
            
            // Create status tick
            statusTicks.push({
              status: statusId,
              targetId: entity.id,
              amount: statusDamage,
              hpBefore,
              hpAfter,
              stacksBefore,
              durationAfter,
              expired,
              lethal: isKill,
            });
            
            // Add death frame if killed by status
            if (isKill) {
              deathFrames.push({
                type: 'death',
                targets: [entity.id],
                cause: statusId,
              });
            }
          }
          
          // Update status duration
          status.duration -= 1;
          
          // Remove expired status
          if (status.duration <= 0) {
            entity.statusEffects.delete(statusId);
          }
        });
      }
      
      // Cleanup statuses for dead entities
      if (!entity.isAlive && entity.statusEffects.size > 0) {
        entity.statusEffects.clear();
      }
    });
    
    // Add round end frame with status ticks
    endFrames.push({
      type: 'round_end',
      roundNumber,
      statusTicks: statusTicks.length > 0 ? statusTicks : undefined,
    });
    
    // Add death frames
    endFrames.push(...deathFrames);
    
    return endFrames;
  }

  private createLeanCombatResult(
    outcome: 'victory' | 'defeat',
    totalRounds: number,
    rounds: LeanRoundDto[],
    logId: string,
    initialActorData: LeanActorDto[],
    rewards?: { gold: number; xp: number; items?: any[] }
  ): LeanCombatResultDto {
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
      version: 'v2-lean',
      logId,
      tickPolicy: 'end_of_round',
      outcome,
      totalRounds,
      actors: initialActorData,
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

