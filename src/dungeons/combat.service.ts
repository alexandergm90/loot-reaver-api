import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CombatResultDto, CombatRoundDto, CombatEntityDto, CombatActionDto } from './dto/combat-response.dto';

interface CombatEntity {
  id: string;
  name: string;
  code?: string; // Enemy code for client-side preview
  currentHp: number;
  maxHp: number;
  damage: number;
  isPlayer: boolean;
  isAlive: boolean;
}

@Injectable()
export class CombatService {
  constructor(private readonly prisma: PrismaService) {}

  async runCombat(
    dungeonId: string,
    level: number,
    characterId: string,
  ): Promise<CombatResultDto> {
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
      })),
    ];

    // Run combat simulation
    const rounds: CombatRoundDto[] = [];
    let roundNumber = 1;
    const maxRounds = 50; // Prevent infinite loops

    while (roundNumber <= maxRounds) {
      const round = this.simulateRound(entities, roundNumber);
      rounds.push(round);

      // Check if combat is over
      const player = entities.find(e => e.isPlayer);
      const aliveEnemies = entities.filter(e => !e.isPlayer && e.isAlive);

      if (!player?.isAlive) {
        // Player defeated
        return {
          outcome: 'defeat',
          totalRounds: roundNumber,
          rounds,
        };
      }

      if (aliveEnemies.length === 0) {
        // All enemies defeated - victory
        const rewards = this.calculateRewards(dungeon, level);
        return {
          outcome: 'victory',
          totalRounds: roundNumber,
          rounds,
          rewards,
        };
      }

      roundNumber++;
    }

    // Combat timeout (shouldn't happen with reasonable stats)
    return {
      outcome: 'defeat',
      totalRounds: maxRounds,
      rounds,
    };
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

  private simulateRound(entities: CombatEntity[], roundNumber: number): CombatRoundDto {
    const actions: CombatActionDto[] = [];
    const aliveEntities = entities.filter(e => e.isAlive);

    // Player always attacks first
    const player = aliveEntities.find(e => e.isPlayer);
    const enemies = aliveEntities.filter(e => !e.isPlayer);

    if (player && enemies.length > 0) {
      // Player attacks first enemy
      const target = enemies[0];
      const targetHpBefore = target.currentHp;
      const damage = this.calculateDamage(player.damage, target);
      const targetHpAfter = Math.max(0, targetHpBefore - damage);
      const isKill = targetHpAfter <= 0;
      
      actions.push({
        attackerId: player.id,
        targetId: target.id,
        damage,
        actionType: 'attack',
        actionId: `player_attack_${roundNumber}_${Date.now()}`,
        ability: 'basic_slash',
        crit: false, // TODO: Implement crit logic
        miss: false, // TODO: Implement miss logic
        blocked: false, // TODO: Implement block logic
        statusApplied: [], // TODO: Implement status effects
        tags: ['melee', 'physical', 'basic'],
        targetHpBefore,
        targetHpAfter,
        kill: isKill,
      });

      target.currentHp = targetHpAfter;
      if (target.currentHp <= 0) {
        target.isAlive = false;
      }

      // If player killed the target, combat might be over
      const aliveEnemiesAfterPlayerAttack = entities.filter(e => !e.isPlayer && e.isAlive);
      if (aliveEnemiesAfterPlayerAttack.length === 0) {
        // All enemies dead, player wins
        return {
          roundNumber,
          actions,
          entities: entities.map(e => ({
            id: e.id,
            name: e.name,
            code: e.code,
            currentHp: e.currentHp,
            maxHp: e.maxHp,
            damage: e.damage,
            isPlayer: e.isPlayer,
          })),
        };
      }
    }

    // Only one enemy attacks back (the first alive enemy)
    const aliveEnemies = entities.filter(e => !e.isPlayer && e.isAlive);
    if (player && player.isAlive && aliveEnemies.length > 0) {
      const attackingEnemy = aliveEnemies[0];
      const targetHpBefore = player.currentHp;
      const damage = this.calculateDamage(attackingEnemy.damage, player);
      const targetHpAfter = Math.max(0, targetHpBefore - damage);
      const isKill = targetHpAfter <= 0;
      
      actions.push({
        attackerId: attackingEnemy.id,
        targetId: player.id,
        damage,
        actionType: 'attack',
        actionId: `enemy_attack_${roundNumber}_${Date.now()}`,
        ability: 'basic_claw', // Default enemy ability
        crit: false, // TODO: Implement crit logic
        miss: false, // TODO: Implement miss logic
        blocked: false, // TODO: Implement block logic
        statusApplied: [], // TODO: Implement status effects
        tags: ['melee', 'physical', 'enemy'],
        targetHpBefore,
        targetHpAfter,
        kill: isKill,
      });

      player.currentHp = targetHpAfter;
      if (player.currentHp <= 0) {
        player.isAlive = false;
      }
    }

    return {
      roundNumber,
      actions,
      entities: entities.map(e => ({
        id: e.id,
        name: e.name,
        code: e.code,
        currentHp: e.currentHp,
        maxHp: e.maxHp,
        damage: e.damage,
        isPlayer: e.isPlayer,
      })),
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

