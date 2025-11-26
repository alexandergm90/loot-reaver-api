import { Injectable } from '@nestjs/common';
import { RawCharacterStats, DerivedCharacterStats, AttackResult } from './stats.types';

@Injectable()
export class StatsCalculationService {
  // Random number generator
  private rng(): number {
    return Math.random();
  }

  /**
   * Aggregates raw stats from equipped items
   * Combines both baseStats (from ItemTemplate) and bonuses (from CharacterItem)
   */
  aggregateRawStats(
    equippedItems: Array<{ template?: any; bonuses?: any; slot?: string; equipped?: boolean; equippedHand?: string | null; isTwoHanded?: boolean }>,
    characterLevel: number
  ): RawCharacterStats {
    const raw: RawCharacterStats = {
      health: 0,
      armor: 0,
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      baseWeaponMin: 0,
      baseWeaponMax: 0,
      attackFlat: 0,
      attackPercent: 0,
      fireFlat: 0,
      lightningFlat: 0,
      poisonFlat: 0,
      critChanceBonus: 0,
      critDamageBonus: 0,
      dodgeChanceBonus: 0,
    };

    // Filter weapons
    const weapons = equippedItems.filter(
      (item) => item.slot === 'weapon' && item.equipped === true
    );

    // Handle weapon stats
    if (weapons.length === 0) {
      // No weapons equipped - use fist damage (base 2)
      raw.baseWeaponMin = 2;
      raw.baseWeaponMax = 2;
    } else {
      // Check for two-handed weapon
      const twoHandedWeapon = weapons.find(
        (w) => w.isTwoHanded || w.template?.isTwoHanded
      );

      if (twoHandedWeapon) {
        // Two-handed weapon - use only this weapon's stats
        this.aggregateWeaponStats(twoHandedWeapon, raw);
      } else {
        // Dual-wield or single weapon
        const mainHand = weapons.find((w) => w.equippedHand === 'right') || weapons[0];
        const offHand = weapons.find((w) => w.equippedHand === 'left' && w !== mainHand);

        // Main hand weapon
        this.aggregateWeaponStats(mainHand, raw);

        // Off hand weapon (if exists)
        if (offHand) {
          this.aggregateWeaponStats(offHand, raw, true); // true = is off-hand
        }
      }
    }

    // Aggregate stats from all other equipment (non-weapons)
    for (const item of equippedItems) {
      if (item.slot !== 'weapon') {
        this.aggregateItemStats(item, raw);
      }
    }

    return raw;
  }

  /**
   * Aggregates stats from a single weapon
   */
  private aggregateWeaponStats(
    weapon: any,
    raw: RawCharacterStats,
    isOffHand: boolean = false
  ): void {
    const baseStats = weapon.template?.baseStats || {};
    const bonuses = weapon.bonuses || {};

    // For dual-wield, off-hand typically does less damage (50% for off-hand)
    const offHandMultiplier = isOffHand ? 0.5 : 1.0;

    // Get weapon damage from bonuses.minAttack/maxAttack, fallback to baseStats.attack
    let weaponMin = bonuses.minAttack;
    let weaponMax = bonuses.maxAttack;

    // If bonuses don't have minAttack/maxAttack, use baseStats.attack (template definition)
    if (weaponMin === undefined && weaponMax === undefined) {
      const baseAttack = baseStats.attack || 2; // Default to fist damage if nothing defined
      weaponMin = baseAttack;
      weaponMax = baseAttack;
    } else if (weaponMin === undefined) {
      weaponMin = weaponMax; // If only max provided, use it for both
    } else if (weaponMax === undefined) {
      weaponMax = weaponMin; // If only min provided, use it for both
    }

    // Apply off-hand multiplier
    weaponMin = Math.floor(weaponMin * offHandMultiplier);
    weaponMax = Math.floor(weaponMax * offHandMultiplier);

    raw.baseWeaponMin += weaponMin;
    raw.baseWeaponMax += weaponMax;

    // Aggregate other weapon stats (but skip attack-related stats since we handled them above)
    this.aggregateItemStats(weapon, raw, offHandMultiplier);
  }

  /**
   * Aggregates stats from a single item (non-weapon or weapon bonuses)
   */
  private aggregateItemStats(
    item: any,
    raw: RawCharacterStats,
    multiplier: number = 1.0
  ): void {
    const baseStats = item.template?.baseStats || {};
    const bonuses = item.bonuses || {};

    // Helper to add stat with multiplier
    const addStat = (key: string, value: number) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        raw[key] = (raw[key] || 0) + Math.floor(value * multiplier);
      }
    };

    // Primary stats - only from bonuses
    addStat('health', bonuses.health || bonuses.hp || 0);
    addStat('armor', bonuses.armor || 0);
    addStat('strength', bonuses.strength || 0);
    addStat('dexterity', bonuses.dexterity || 0);
    addStat('intelligence', bonuses.intelligence || 0);

    // Attack stats - only from bonuses
    addStat('attackFlat', bonuses.attackFlat || 0);
    if (bonuses.attackPercent !== undefined) {
      raw.attackPercent += bonuses.attackPercent;
    }

    // Elemental stats - only from bonuses (fire, lightning, poison)
    addStat('fireFlat', bonuses.fire || 0);
    addStat('lightningFlat', bonuses.lightning || 0);
    addStat('poisonFlat', bonuses.poison || 0);

    // Crit stats - only from bonuses
    if (bonuses.critChance !== undefined) {
      raw.critChanceBonus += bonuses.critChance;
    }
    if (bonuses.critDamage !== undefined) {
      raw.critDamageBonus += bonuses.critDamage;
    }

    // Dodge stats - only from bonuses
    if (bonuses.dodgeChance !== undefined) {
      raw.dodgeChanceBonus += bonuses.dodgeChance;
    }

    // Spell stats - only from bonuses
    if (bonuses.spellBaseDamage !== undefined) {
      raw.spellBaseDamage = (raw.spellBaseDamage || 0) + bonuses.spellBaseDamage * multiplier;
    }
    if (bonuses.spellProcChance !== undefined) {
      raw.spellProcChance = Math.max(
        raw.spellProcChance || 0,
        bonuses.spellProcChance
      );
    }
    if (bonuses.spellDamageBonus !== undefined) {
      raw.spellDamageBonus = (raw.spellDamageBonus || 0) + bonuses.spellDamageBonus * multiplier;
    }

    // Status effect bonuses - only from bonuses
    if (bonuses.burnChance !== undefined) {
      raw.burnChanceBonus = (raw.burnChanceBonus || 0) + bonuses.burnChance * multiplier;
    }
    if (bonuses.poisonChance !== undefined) {
      raw.poisonChanceBonus = (raw.poisonChanceBonus || 0) + bonuses.poisonChance * multiplier;
    }
    if (bonuses.stunChance !== undefined) {
      raw.stunChanceBonus = (raw.stunChanceBonus || 0) + bonuses.stunChance * multiplier;
    }
  }

  /**
   * Calculates derived stats by applying formulas to raw stats
   */
  calculateDerivedStats(
    rawStats: RawCharacterStats,
    characterLevel: number,
    attackType: string = 'smashes'
  ): DerivedCharacterStats {
    // Health: 20 + FlatHealthFromGear + FlatHealthFromSkillsAndBuffs
    const health = 20 + rawStats.health;

    // Armor: base 0 + from gear
    const armor = rawStats.armor;

    // Physical Attack: (BaseWeaponDamage + AttackFlat) * (1 + STR * 0.02) * (1 + AttackPercent)
    const strengthScaling = 1 + rawStats.strength * 0.02;
    const physicalBaseMin = (rawStats.baseWeaponMin + rawStats.attackFlat) * strengthScaling;
    const physicalBaseMax = (rawStats.baseWeaponMax + rawStats.attackFlat) * strengthScaling;
    const physicalDamageMin = physicalBaseMin * (1 + rawStats.attackPercent);
    const physicalDamageMax = physicalBaseMax * (1 + rawStats.attackPercent);

    // Elemental Damage: (FireFlat + LightningFlat + PoisonFlat) * (1 + INT * 0.02)
    const elementalFlat = rawStats.fireFlat + rawStats.lightningFlat + rawStats.poisonFlat;
    const elementalScaling = 1 + rawStats.intelligence * 0.02;
    const elementalDamage = elementalFlat * elementalScaling;

    // Crit Chance: 0.05 + CritFromDex + CritChanceBonus (with soft cap)
    const critChance = this.calcCritChance(rawStats, characterLevel);

    // Crit Multiplier: 1.5 + CritDamageBonus
    const critMultiplier = 1.5 + rawStats.critDamageBonus;

    // Dodge Chance: 0.02 + DodgeFromDex + DodgeChanceBonus (with soft cap)
    const dodgeChance = this.calcDodgeChance(rawStats, characterLevel);

    // Physical Reduction: Armor / (Armor + 50 + 5 * AttackerLevel)
    // Note: This is calculated per-attack based on attacker level, so we'll provide a helper
    // For display purposes, we can calculate against a typical enemy level (e.g., character level)
    const physicalReduction = this.physicalReduction(armor, characterLevel);

    // Spell Damage
    let spellDamage: number | undefined;
    if (rawStats.spellBaseDamage) {
      const spellScaling = 1 + (rawStats.intelligence * 0.03) + (rawStats.spellDamageBonus || 0);
      spellDamage = rawStats.spellBaseDamage * spellScaling;
    }

    // Status proc chances
    const burnChance = this.burnChance(rawStats);
    const poisonChance = this.poisonChance(rawStats);
    const stunChance = this.stunChance(rawStats);

    const roundedElemental = Math.round(elementalDamage);
    const roundedPhysicalMin = Math.round(physicalDamageMin);
    const roundedPhysicalMax = Math.round(physicalDamageMax);

    return {
      health,
      armor,
      strength: rawStats.strength,
      dexterity: rawStats.dexterity,
      intelligence: rawStats.intelligence,
      physicalDamageMin: roundedPhysicalMin,
      physicalDamageMax: roundedPhysicalMax,
      elementalDamage: roundedElemental,
      // Always include totalDamage for consistency (even if elemental is 0)
      totalDamageMin: roundedPhysicalMin + roundedElemental,
      totalDamageMax: roundedPhysicalMax + roundedElemental,
      critChance,
      critMultiplier,
      dodgeChance,
      physicalReduction,
      spellDamage: spellDamage ? Math.round(spellDamage) : undefined,
      spellProcChance: rawStats.spellProcChance,
      burnChance,
      poisonChance,
      stunChance,
      attackType,
    };
  }

  /**
   * Calculates crit chance with soft cap based on DEX and level
   */
  calcCritChance(stats: RawCharacterStats, level: number): number {
    const baseCrit = 0.05;
    const maxFromDex = 0.35;
    const scale = 5;
    const offset = 10;

    const fromDex = maxFromDex * (
      stats.dexterity / (stats.dexterity + scale * level + offset)
    );

    return Math.min(1.0, baseCrit + fromDex + stats.critChanceBonus);
  }

  /**
   * Calculates dodge chance with soft cap based on DEX and level
   */
  calcDodgeChance(stats: RawCharacterStats, level: number): number {
    const baseDodge = 0.02;
    const maxFromDex = 0.25;
    const scale = 5;
    const offset = 10;

    const fromDex = maxFromDex * (
      stats.dexterity / (stats.dexterity + scale * level + offset)
    );

    return Math.min(1.0, baseDodge + fromDex + stats.dodgeChanceBonus);
  }

  /**
   * Calculates physical damage reduction from armor
   */
  physicalReduction(armor: number, attackerLevel: number): number {
    return armor / (armor + 50 + 5 * attackerLevel);
  }

  /**
   * Calculates burn proc chance
   */
  private burnChance(stats: RawCharacterStats): number {
    const base = stats.fireFlat > 0 ? 0.10 : 0;
    return Math.min(1.0, base + stats.intelligence * 0.001 + (stats.burnChanceBonus || 0));
  }

  /**
   * Calculates poison proc chance
   */
  private poisonChance(stats: RawCharacterStats): number {
    const base = stats.poisonFlat > 0 ? 0.10 : 0;
    return Math.min(1.0, base + stats.intelligence * 0.0015 + (stats.poisonChanceBonus || 0));
  }

  /**
   * Calculates stun proc chance
   */
  private stunChance(stats: RawCharacterStats): number {
    const base = stats.lightningFlat > 0 ? 0.05 : 0;
    return Math.min(1.0, base + stats.intelligence * 0.0008 + (stats.stunChanceBonus || 0));
  }

  /**
   * Resolves an attack with all mechanics (dodge, crit, damage, status effects)
   */
  resolveAttack(
    attackerStats: DerivedCharacterStats,
    defenderStats: DerivedCharacterStats,
    attackerLevel: number
  ): AttackResult {
    let hit = true;
    let crit = false;
    let spellProc = false;

    // 1. Dodge/Miss check
    const dodge = defenderStats.dodgeChance;
    if (this.rng() < dodge) {
      return {
        hit: false,
        crit: false,
        physicalDamage: 0,
        elementalDamage: 0,
        spellDamage: 0,
        totalDamage: 0,
        statuses: { burn: false, poison: false, stun: false },
        spellProc: false,
      };
    }

    // 2. Calculate base damages
    let physicalBase = this.randomWeaponDamage(
      attackerStats.physicalDamageMin,
      attackerStats.physicalDamageMax
    );
    let elemental = attackerStats.elementalDamage;

    // 3. Critical hit check
    const critChance = attackerStats.critChance;
    if (this.rng() < critChance) {
      crit = true;
      const mult = attackerStats.critMultiplier;
      physicalBase = physicalBase * mult;
      elemental = elemental * mult;
    }

    // 4. Armor mitigation (only for physical)
    const reduction = this.physicalReduction(defenderStats.armor, attackerLevel);
    const physicalAfterArmor = physicalBase * (1 - reduction);

    // 5. Spell proc check
    let spellDamage = 0;
    if (attackerStats.spellProcChance && this.rng() < attackerStats.spellProcChance) {
      spellProc = true;
      spellDamage = attackerStats.spellDamage || 0;
    }

    // 6. Elemental Status Effects
    const statuses = {
      burn: this.rng() < (attackerStats.burnChance || 0),
      poison: this.rng() < (attackerStats.poisonChance || 0),
      stun: this.rng() < (attackerStats.stunChance || 0),
    };

    // 7. Final total damage
    const totalDamage = Math.round(physicalAfterArmor) + Math.round(elemental) + Math.round(spellDamage);

    return {
      hit,
      crit,
      physicalDamage: Math.round(physicalAfterArmor),
      elementalDamage: Math.round(elemental),
      spellDamage: Math.round(spellDamage),
      totalDamage,
      statuses,
      spellProc,
    };
  }

  /**
   * Random weapon damage within range
   */
  private randomWeaponDamage(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

