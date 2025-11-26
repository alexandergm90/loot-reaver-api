import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StatsCalculationService } from '@/common/stats/stats-calculation.service';
import { ItemSlot } from '@prisma/client';

@Injectable()
export class CharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsCalculation: StatsCalculationService
  ) {}

  async getCharacterWithEquipment(userId: string) {
    const character = await this.prisma.character.findFirst({
      where: { userId },
      include: {
        appearance: true,
        resources: true,
        items: { where: { equipped: true }, include: { template: true } },
      },
    });
    if (!character) return null;

    // Determine attack type from weapon
    const weapon = character.items.find((i) => i.slot === 'weapon');
    const baseStats = weapon?.template?.baseStats as any;
    const attackType = baseStats?.attackType || 'smashes';

    const derivedStats = this.computeDerivedStats(character.items, character.level, attackType);

    return {
      id: character.id,
      name: character.name,
      title: character.title,
      level: character.level,
      experience: character.experience,
      trait: character.trait,
      appearance: character.appearance,
      resources: character.resources,
      items: character.items.map((i) => ({
        id: i.id,
        slot: i.slot,
        rarity: i.rarity,
        code: i.template.code,
        equippedHand: i.equippedHand,
        template: i.template,
      })),
      derivedStats,
    };
  }

  async getInventory(userId: string) {
    const character = await this.prisma.character.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!character) return [];
    const items = await this.prisma.characterItem.findMany({
      where: { characterId: character.id, equipped: false },
      include: { template: true },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((i) => ({
      id: i.id,
      slot: i.slot,
      rarity: i.rarity,
      durability: i.durability,
      template: i.template,
    }));
  }

  async getItemDetails(userId: string, itemId: string) {
    const item = await this.prisma.characterItem.findFirst({
      where: { id: itemId },
      include: {
        template: true,
        character: { select: { id: true, userId: true } },
      },
    });

    if (!item) throw new NotFoundException('Item not found');
    if (item.character.userId !== userId) throw new ForbiddenException('Cannot view item you do not own');

    return {
      id: item.id,
      slot: item.slot,
      rarity: item.rarity,
      equipped: item.equipped,
      equippedHand: item.equippedHand,
      isTwoHanded: item.isTwoHanded || item.template.isTwoHanded,
      durability: item.durability,
      socketedRunes: item.socketedRunes,
      bonuses: item.bonuses,
      createdAt: item.createdAt,
      template: item.template,
    };
  }

  async equipItem(userId: string, itemId: string, slot?: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.characterItem.findFirst({
        where: { id: itemId },
        include: { template: true, character: { select: { id: true, userId: true } } },
      });
      if (!item) throw new NotFoundException('Item not found');
      if (item.character.userId !== userId) throw new ForbiddenException('Cannot equip item you do not own');

      // Determine if item is two-handed (from template or characterItem)
      const isTwoHanded = item.template.isTwoHanded || item.isTwoHanded;
      const itemSlot = item.slot;

      // Validation: Check if item is already equipped
      if (item.equipped) {
        // Check if already equipped to the requested hand
        const requestedHand = this.determineEquippedHand(itemSlot, slot);
        if (item.equippedHand === requestedHand) {
          // Already equipped correctly, return current state
          const character = await tx.character.findUnique({
            where: { id: item.character.id },
            select: { level: true },
          });
          const equipped = await tx.characterItem.findMany({
            where: { characterId: item.character.id, equipped: true },
            include: { template: true },
          });
          const weapon = equipped.find((i) => i.slot === 'weapon');
          const baseStats = weapon?.template?.baseStats as any;
          const attackType = baseStats?.attackType || 'smashes';
          const derivedStats = this.computeDerivedStats(equipped, character?.level || 1, attackType);
          return this.formatEquippedResponse(equipped, derivedStats);
        }
      }

      // Validation: Slot parameter for weapons, rings, and shields
      const requestedHand = this.determineEquippedHand(itemSlot, slot);
      if (itemSlot === 'weapon' || itemSlot === 'ring' || itemSlot === 'shield') {
        if (slot && slot !== 'left' && slot !== 'right') {
          throw new BadRequestException(`Slot parameter must be "left" or "right" for ${itemSlot}`);
        }
      }

      // Get currently equipped items to check conflicts
      const currentlyEquipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      // Handle two-handed weapon conflicts
      if (isTwoHanded && itemSlot === 'weapon') {
        // Unequip all weapons and shield
        await tx.characterItem.updateMany({
          where: {
            characterId: item.character.id,
            equipped: true,
            OR: [
              { slot: 'weapon' },
              { slot: 'shield' },
            ],
          },
          data: { equipped: false, equippedHand: null },
        });
      } else if (itemSlot === 'shield') {
        // Shield can only be equipped to left hand
        if (requestedHand !== 'left') {
          throw new BadRequestException('Shield must be equipped to left hand');
        }
        // Unequip two-handed weapons
        const twoHandedWeapons = currentlyEquipped.filter(
          (e) => e.slot === 'weapon' && (e.template.isTwoHanded || e.isTwoHanded)
        );
        for (const weapon of twoHandedWeapons) {
          await tx.characterItem.update({
            where: { id: weapon.id },
            data: { equipped: false, equippedHand: null },
          });
        }
        // Unequip any one-handed weapon in the left hand (shields are always left hand)
        await tx.characterItem.updateMany({
          where: {
            characterId: item.character.id,
            slot: 'weapon',
            equipped: true,
            equippedHand: 'left',
          },
          data: { equipped: false, equippedHand: null },
        });
        // Unequip any shield already equipped
        await tx.characterItem.updateMany({
          where: {
            characterId: item.character.id,
            slot: 'shield',
            equipped: true,
          },
          data: { equipped: false, equippedHand: null },
        });
      } else if (itemSlot === 'weapon' && !isTwoHanded) {
        // One-handed weapon: unequip two-handed weapons first
        const twoHandedWeapons = currentlyEquipped.filter(
          (e) => e.slot === 'weapon' && (e.template.isTwoHanded || e.isTwoHanded)
        );
        for (const weapon of twoHandedWeapons) {
          await tx.characterItem.update({
            where: { id: weapon.id },
            data: { equipped: false, equippedHand: null },
          });
        }
        // If equipping to left hand, unequip shield (shields are always left hand)
        if (requestedHand === 'left') {
          await tx.characterItem.updateMany({
            where: {
              characterId: item.character.id,
              slot: 'shield',
              equipped: true,
            },
            data: { equipped: false, equippedHand: null },
          });
        }
        // Unequip weapon in the same hand only
        await tx.characterItem.updateMany({
          where: {
            characterId: item.character.id,
            slot: 'weapon',
            equipped: true,
            equippedHand: requestedHand,
          },
          data: { equipped: false, equippedHand: null },
        });
      } else if (itemSlot === 'ring') {
        // Rings: only unequip ring in the same hand
        await tx.characterItem.updateMany({
          where: {
            characterId: item.character.id,
            slot: 'ring',
            equipped: true,
            equippedHand: requestedHand,
          },
          data: { equipped: false, equippedHand: null },
        });
      } else {
        // Other slots: unequip all items in the same slot
        await tx.characterItem.updateMany({
          where: {
            characterId: item.character.id,
            slot: itemSlot,
            equipped: true,
          },
          data: { equipped: false, equippedHand: null },
        });
      }

      // Equip the requested item
      await tx.characterItem.update({
        where: { id: item.id },
        data: {
          equipped: true,
          equippedHand: requestedHand,
          isTwoHanded: isTwoHanded,
        },
      });

      // Get character level and determine attack type
      const character = await tx.character.findUnique({
        where: { id: item.character.id },
        select: { level: true },
      });
      
      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const weapon = equipped.find((i) => i.slot === 'weapon');
      const baseStats = weapon?.template?.baseStats as any;
      const attackType = baseStats?.attackType || 'smashes';
      const derivedStats = this.computeDerivedStats(equipped, character?.level || 1, attackType);

      return this.formatEquippedResponse(equipped, derivedStats);
    });
  }

  private determineEquippedHand(itemSlot: ItemSlot, slot?: string): string | null {
    // For weapons, rings, and shields, determine which hand
    if (itemSlot === 'weapon' || itemSlot === 'ring' || itemSlot === 'shield') {
      // Shield always goes to left hand
      if (itemSlot === 'shield') return 'left';
      // Use provided slot or default to 'left'
      return slot === 'right' ? 'right' : 'left';
    }
    // Other slots don't use hand
    return null;
  }

  private formatEquippedResponse(equipped: any[], derivedStats: Record<string, number>) {
    return {
      equipped: equipped.map((e) => ({
        id: e.id,
        slot: e.slot,
        rarity: e.rarity,
        code: e.template.code,
        equippedHand: e.equippedHand,
        template: e.template,
      })),
      derivedStats,
    };
  }

  async unequipItem(userId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.characterItem.findFirst({
        where: { id: itemId },
        include: { character: { select: { id: true, userId: true } } },
      });
      if (!item) throw new NotFoundException('Item not found');
      if (item.character.userId !== userId) throw new ForbiddenException('Cannot unequip item you do not own');
      if (!item.equipped) throw new BadRequestException('Item is not equipped');

      // Unequip the item
      await tx.characterItem.update({
        where: { id: item.id },
        data: { equipped: false, equippedHand: null },
      });

      // Get character level and determine attack type
      const character = await tx.character.findUnique({
        where: { id: item.character.id },
        select: { level: true },
      });
      
      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const weapon = equipped.find((i) => i.slot === 'weapon');
      const baseStats = weapon?.template?.baseStats as any;
      const attackType = baseStats?.attackType || 'smashes';
      const derivedStats = this.computeDerivedStats(equipped, character?.level || 1, attackType);

      return this.formatEquippedResponse(equipped, derivedStats);
    });
  }
  
  private computeDerivedStats(
    equipped: Array<{ template?: any; bonuses?: any; slot?: string; equipped?: boolean; equippedHand?: string | null; isTwoHanded?: boolean }>,
    characterLevel: number,
    attackType: string = 'smashes'
  ): Record<string, any> {
    // Aggregate raw stats from equipment
    const rawStats = this.statsCalculation.aggregateRawStats(equipped, characterLevel);
    
    // Calculate derived stats
    const derivedStats = this.statsCalculation.calculateDerivedStats(rawStats, characterLevel, attackType);
    
    // Convert to a flat record for backward compatibility, but include all calculated values
    return {
      // Primary stats
      health: derivedStats.health,
      armor: derivedStats.armor,
      strength: derivedStats.strength,
      dexterity: derivedStats.dexterity,
      intelligence: derivedStats.intelligence,
      
      // Attack stats
      physicalDamageMin: derivedStats.physicalDamageMin,
      physicalDamageMax: derivedStats.physicalDamageMax,
      elementalDamage: derivedStats.elementalDamage,
      totalDamageMin: derivedStats.totalDamageMin,
      totalDamageMax: derivedStats.totalDamageMax,
      
      // Defense stats
      critChance: derivedStats.critChance,
      critMultiplier: derivedStats.critMultiplier,
      dodgeChance: derivedStats.dodgeChance,
      physicalReduction: derivedStats.physicalReduction,
      
      // Spell stats
      ...(derivedStats.spellDamage !== undefined && { spellDamage: derivedStats.spellDamage }),
      ...(derivedStats.spellProcChance !== undefined && { spellProcChance: derivedStats.spellProcChance }),
      
      // Status proc chances
      ...(derivedStats.burnChance !== undefined && { burnChance: derivedStats.burnChance }),
      ...(derivedStats.poisonChance !== undefined && { poisonChance: derivedStats.poisonChance }),
      ...(derivedStats.stunChance !== undefined && { stunChance: derivedStats.stunChance }),
      
      // Attack type
      attackType: derivedStats.attackType,
    };
  }
}



