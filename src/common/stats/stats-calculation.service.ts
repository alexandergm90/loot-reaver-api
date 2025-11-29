import { Injectable } from '@nestjs/common';
import { RawCharacterStats, DerivedCharacterStats, AttackResult } from './stats.types';

// Spell-to-element mapping - easily extensible for new spells
const SPELL_ELEMENT_MAP: Record<string, 'fire' | 'lightning' | 'poison'> = {
  fireball: 'fire',
  arcBolt: 'lightning',
  toxicBolt: 'poison',
};

// Spell-specific scaling values - easily extensible for new spells
const SPELL_SCALING: Record<string, { intScaling: number; elementScaling: number }> = {
  fireball: { intScaling: 0.7, elementScaling: 1.0 },
  arcBolt: { intScaling: 0.5, elementScaling: 0.8 },
  toxicBolt: { intScaling: 0.6, elementScaling: 1.2 },
};

@Injectable()
export class StatsCalculationService {
  // Random number generator
  private rng(): number {
    return Math.random();
  }

  // Type guard for spell data
  private isValidSpellData(data: unknown): data is { chance: number; damage: number } {
    return (
      data !== null &&
      typeof data === 'object' &&
      'chance' in data &&
      'damage' in data &&
      typeof (data as any).chance === 'number' &&
      typeof (data as any).damage === 'number'
    );
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
      fireFlat: 0,
      lightningFlat: 0,
      poisonFlat: 0,
      critChanceBonus: 0,
      critDamageBonus: 0,
      dodgeChanceBonus: 0,
      blockChanceBonus: 0,
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

    // Get weapon damage from bonuses.primary.minAttack/maxAttack, fallback to baseStats.attack
    const primary = bonuses.primary || {};
    let weaponMin = primary.minAttack;
    let weaponMax = primary.maxAttack;

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
    // For offhand weapons, skip spells (spells only proc from mainhand or two-handed weapons)
    this.aggregateItemStats(weapon, raw, offHandMultiplier, isOffHand);
  }

  /**
   * Aggregates stats from a single item (non-weapon or weapon bonuses)
   */
  private aggregateItemStats(
    item: any,
    raw: RawCharacterStats,
    multiplier: number = 1.0,
    skipSpells: boolean = false
  ): void {
    const bonuses = item.bonuses || {};

    // Helper to add stat with multiplier
    const addStat = (key: string, value: number) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        raw[key] = (raw[key] || 0) + Math.floor(value * multiplier);
      }
    };

    // Read from nested structure
    const primary = bonuses.primary || {};
    const attributes = bonuses.attributes || {};
    const elementPower = bonuses.elementPower || {};
    const special = bonuses.special || {};
    const spells = bonuses.spells || {};

    // Primary stats - from bonuses.primary
    addStat('health', primary.health || 0);
    addStat('armor', primary.armor || 0);

    // Attributes - from bonuses.attributes
    addStat('strength', attributes.strength || 0);
    addStat('dexterity', attributes.dexterity || 0);
    addStat('intelligence', attributes.intelligence || 0);

    // Elemental stats - from bonuses.elementPower
    addStat('fireFlat', elementPower.fire || 0);
    addStat('lightningFlat', elementPower.lightning || 0);
    addStat('poisonFlat', elementPower.poison || 0);

    // Special stats - from bonuses.special
    if (special.critChance !== undefined) {
      raw.critChanceBonus += special.critChance;
    }
    if (special.critDamage !== undefined) {
      raw.critDamageBonus += special.critDamage;
    }
    if (special.dodgeChance !== undefined) {
      raw.dodgeChanceBonus += special.dodgeChance;
    }
    if (special.blockChance !== undefined) {
      raw.blockChanceBonus += special.blockChance;
    }

    // Spells - from bonuses.spells (skip if this is an offhand weapon)
    if (!skipSpells) {
      // Initialize spells object if not exists
      if (!raw.spells) {
        raw.spells = {};
      }

      // Process each spell in bonuses.spells
      for (const [spellName, spellData] of Object.entries(spells)) {
        if (this.isValidSpellData(spellData)) {
          const element = SPELL_ELEMENT_MAP[spellName] || 'fire'; // Default to fire if not mapped
          const existingSpell = raw.spells[spellName];
          
          if (existingSpell) {
            // Use highest chance, sum damage
            raw.spells[spellName] = {
              chance: Math.max(existingSpell.chance, spellData.chance),
              damage: existingSpell.damage + spellData.damage * multiplier,
              element: existingSpell.element, // Keep first element
            };
          } else {
            raw.spells[spellName] = {
              chance: spellData.chance,
              damage: spellData.damage * multiplier,
              element,
            };
          }
        }
      }
    }

    // Status effect bonuses - keep in flat structure for now
    if (bonuses.burnChance !== undefined) {
      raw.burnChanceBonus = (raw.burnChanceBonus || 0) + bonuses.burnChance * multiplier;
    }
    if (bonuses.burnDamage !== undefined) {
      raw.burnDamageBonus = (raw.burnDamageBonus || 0) + bonuses.burnDamage * multiplier;
    }
    if (bonuses.poisonChance !== undefined) {
      raw.poisonChanceBonus = (raw.poisonChanceBonus || 0) + bonuses.poisonChance * multiplier;
    }
    if (bonuses.poisonDamage !== undefined) {
      raw.poisonDamageBonus = (raw.poisonDamageBonus || 0) + bonuses.poisonDamage * multiplier;
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

    // Physical Attack: BaseWeaponDamage * (1 + STR * 0.02)
    const strengthScaling = 1 + rawStats.strength * 0.02;
    const physicalDamageMin = rawStats.baseWeaponMin * strengthScaling;
    const physicalDamageMax = rawStats.baseWeaponMax * strengthScaling;

    // Elemental Damage: (FireFlat + LightningFlat + PoisonFlat) * (1 + INT * 0.02)
    const elementalScaling = 1 + rawStats.intelligence * 0.02;
    const fireDamage = rawStats.fireFlat * elementalScaling;
    const lightningDamage = rawStats.lightningFlat * elementalScaling;
    const poisonDamage = rawStats.poisonFlat * elementalScaling;
    const elementalDamage = fireDamage + lightningDamage + poisonDamage;

    // Crit Chance: 0.05 + CritFromDex + CritChanceBonus (with soft cap)
    const critChance = this.calcCritChance(rawStats, characterLevel);

    // Spell Crit Chance: 0.05 + CritFromInt + CritChanceBonus (with soft cap)
    const spellCritChance = this.calcSpellCritChance(rawStats, characterLevel);

    // Crit Multiplier: 1.5 + CritDamageBonus
    const critMultiplier = 1.5 + rawStats.critDamageBonus;

    // Dodge Chance: 0.02 + DodgeFromDex + DodgeChanceBonus (with soft cap)
    const dodgeChance = this.calcDodgeChance(rawStats, characterLevel);

    // Block Chance: 0.01 + BlockFromStr + BlockChanceBonus (with soft cap, 2x lower than dodge)
    const blockChance = this.calcBlockChance(rawStats, characterLevel);

    // Physical Reduction: Armor / (Armor + 50 + 5 * AttackerLevel)
    // Note: This is calculated per-attack based on attacker level, so we'll provide a helper
    // For display purposes, we can calculate against a typical enemy level (e.g., character level)
    const physicalReduction = this.physicalReduction(armor, characterLevel);

    // Spells - calculate damage for each spell and keep the full map
    const calculatedSpells: Record<string, { chance: number; damage: number; element: 'fire' | 'lightning' | 'poison' }> = {};
    
    if (rawStats.spells && Object.keys(rawStats.spells).length > 0) {
      for (const [spellName, spellData] of Object.entries(rawStats.spells)) {
        // Get spell-specific scaling values
        const scaling = SPELL_SCALING[spellName] || { intScaling: 0.5, elementScaling: 1.0 };
        
        // Calculate spell damage with spell-specific scaling:
        // Base spell damage scaled by INT with spell-specific intScaling
        const spellBaseScaling = 1 + rawStats.intelligence * scaling.intScaling;
        const scaledBaseDamage = spellData.damage * spellBaseScaling;
        
        // Elemental power scaled by standard INT scaling (0.02) then by spell-specific elementScaling
        const elementalIntScaling = 1 + rawStats.intelligence * 0.02;
        let elementalBonus = 0;
        
        if (spellData.element === 'fire') {
          elementalBonus = rawStats.fireFlat * elementalIntScaling * scaling.elementScaling;
        } else if (spellData.element === 'lightning') {
          elementalBonus = rawStats.lightningFlat * elementalIntScaling * scaling.elementScaling;
        } else if (spellData.element === 'poison') {
          elementalBonus = rawStats.poisonFlat * elementalIntScaling * scaling.elementScaling;
        }
        
        // Spell damage = (base spell damage * spell int scaling) + (elemental power * standard int scaling * spell element scaling)
        const finalSpellDamage = scaledBaseDamage + elementalBonus;
        
        calculatedSpells[spellName] = {
          chance: spellData.chance,
          damage: finalSpellDamage,
          element: spellData.element,
        };
      }
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
      fireDamage: Math.round(fireDamage),
      lightningDamage: Math.round(lightningDamage),
      poisonDamage: Math.round(poisonDamage),
      // Always include totalDamage for consistency (even if elemental is 0)
      totalDamageMin: roundedPhysicalMin + roundedElemental,
      totalDamageMax: roundedPhysicalMax + roundedElemental,
      critChance,
      critMultiplier,
      spellCritChance,
      dodgeChance,
      blockChance,
      physicalReduction,
      spells: Object.keys(calculatedSpells).length > 0 ? calculatedSpells : undefined,
      burnChance,
      poisonChance,
      stunChance,
      burnDamageBonus: rawStats.burnDamageBonus,
      poisonDamageBonus: rawStats.poisonDamageBonus,
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
   * Calculates spell crit chance with soft cap based on INT and level
   * Same formula as physical crit but uses intelligence instead of dexterity
   */
  calcSpellCritChance(stats: RawCharacterStats, level: number): number {
    const baseCrit = 0.05;
    const maxFromInt = 0.35;
    const scale = 5;
    const offset = 10;

    const fromInt = maxFromInt * (
      stats.intelligence / (stats.intelligence + scale * level + offset)
    );

    return Math.min(1.0, baseCrit + fromInt + stats.critChanceBonus);
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
   * Calculates block chance with soft cap based on STR and level
   * Uses 2x lower caps than dodge (half the percentage)
   */
  calcBlockChance(stats: RawCharacterStats, level: number): number {
    const baseBlock = 0.01; // 1% base (half of dodge's 2%)
    const maxFromStr = 0.125; // 12.5% max from STR (half of dodge's 25%)
    const scale = 5;
    const offset = 10;

    const fromStr = maxFromStr * (
      stats.strength / (stats.strength + scale * level + offset)
    );

    return Math.min(1.0, baseBlock + fromStr + stats.blockChanceBonus);
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

    // 5. Spell proc check - roll for each spell and use the first one that procs
    let spellDamage = 0;
    let spellName: string | undefined;
    let spellCrit = false;
    
    if (attackerStats.spells && Object.keys(attackerStats.spells).length > 0) {
      // Roll for each spell in order, use the first one that procs
      for (const [spellNameKey, spell] of Object.entries(attackerStats.spells)) {
        if (this.rng() < spell.chance) {
          spellProc = true;
          spellDamage = spell.damage;
          spellName = spellNameKey;
          
          // Check for spell crit (based on intelligence)
          if (this.rng() < attackerStats.spellCritChance) {
            spellCrit = true;
            spellDamage = spellDamage * attackerStats.critMultiplier;
          }
          
          break; // Use first spell that procs
        }
      }
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
      spellCrit: spellCrit || undefined,
      physicalDamage: Math.round(physicalAfterArmor),
      elementalDamage: Math.round(elemental),
      spellDamage: Math.round(spellDamage),
      totalDamage,
      statuses,
      spellProc,
      spellName,
    };
  }

  /**
   * Random weapon damage within range
   */
  private randomWeaponDamage(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

