// Raw stats aggregated from equipment (baseStats + bonuses)
export interface RawCharacterStats {
  // Primary stats
  health: number;
  armor: number;
  strength: number;
  dexterity: number;
  intelligence: number;

  // Attack stats
  baseWeaponMin: number;
  baseWeaponMax: number;
  attackFlat: number;       // +X attack
  attackPercent: number;   // +Y% attack

  // Elemental stats
  fireFlat: number;
  lightningFlat: number;
  poisonFlat: number;

  // Crit stats
  critChanceBonus: number;      // from skills/items
  critDamageBonus: number;      // +X to crit multiplier

  // Dodge stats
  dodgeChanceBonus: number;

  // Spell system (optional)
  spellBaseDamage?: number;
  spellProcChance?: number;
  spellDamageBonus?: number;

  // Status effect bonuses (optional)
  burnChanceBonus?: number;
  poisonChanceBonus?: number;
  stunChanceBonus?: number;
}

// Derived stats after applying formulas
export interface DerivedCharacterStats {
  // Primary stats
  health: number;
  armor: number;
  strength: number;
  dexterity: number;
  intelligence: number;

  // Attack stats
  physicalDamageMin: number;
  physicalDamageMax: number;
  elementalDamage: number;
  totalDamageMin: number;
  totalDamageMax: number;

  // Defense stats
  critChance: number;
  critMultiplier: number;
  dodgeChance: number;
  physicalReduction: number; // percentage (0-1)

  // Spell stats
  spellDamage?: number;
  spellProcChance?: number;

  // Status proc chances
  burnChance?: number;
  poisonChance?: number;
  stunChance?: number;

  // Attack type (for display)
  attackType: string; // 'smashes', 'slashes', etc.
}

// Result of an attack resolution
export interface AttackResult {
  hit: boolean;
  crit: boolean;

  physicalDamage: number;
  elementalDamage: number;
  spellDamage: number;
  totalDamage: number;

  statuses: {
    burn: boolean;
    poison: boolean;
    stun: boolean;
  };

  spellProc: boolean;
}

