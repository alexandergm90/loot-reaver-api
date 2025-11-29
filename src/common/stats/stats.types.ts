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

  // Elemental stats
  fireFlat: number;
  lightningFlat: number;
  poisonFlat: number;

  // Crit stats
  critChanceBonus: number;      // from skills/items
  critDamageBonus: number;      // +X to crit multiplier

  // Dodge stats
  dodgeChanceBonus: number;

  // Block stats
  blockChanceBonus: number;      // from shield bonuses

  // Spell system (optional)
  // Object of spell name to spell data: { chance: number, damage: number, element: 'fire' | 'lightning' | 'poison' }
  spells?: Record<string, { chance: number; damage: number; element: 'fire' | 'lightning' | 'poison' }>;

  // Status effect bonuses (optional)
  burnChanceBonus?: number;
  burnDamageBonus?: number;      // +X% to burn DoT damage
  poisonChanceBonus?: number;
  poisonDamageBonus?: number;    // +X% to poison DoT damage
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
  fireDamage: number;
  lightningDamage: number;
  poisonDamage: number;
  totalDamageMin: number;
  totalDamageMax: number;

  // Defense stats
  critChance: number;
  critMultiplier: number;
  spellCritChance: number; // Spell crit chance based on intelligence
  dodgeChance: number;
  blockChance: number;
  physicalReduction: number; // percentage (0-1)

  // Spell system - keep full map of spells with calculated damage
  spells?: Record<string, { chance: number; damage: number; element: 'fire' | 'lightning' | 'poison' }>;

  // Status proc chances
  burnChance?: number;
  poisonChance?: number;
  stunChance?: number;

  // Status DoT damage bonuses (percentage multipliers)
  burnDamageBonus?: number;      // +X% to burn DoT damage (e.g., 0.1 = 10%)
  poisonDamageBonus?: number;    // +X% to poison DoT damage (e.g., 0.15 = 15%)

  // Attack type (for display)
  attackType: string; // 'smashes', 'slashes', etc.
}

// Result of an attack resolution
export interface AttackResult {
  hit: boolean;
  crit: boolean;
  spellCrit?: boolean; // Whether the spell crit

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
  spellName?: string; // Which spell actually procced
}

