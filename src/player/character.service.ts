import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ItemSlot } from '@prisma/client';

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

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

    const derivedStats = this.computeDerivedStats(character.items);

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
          const equipped = await tx.characterItem.findMany({
            where: { characterId: item.character.id, equipped: true },
            include: { template: true },
          });
          const derivedStats = this.computeDerivedStats(equipped);
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

      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const derivedStats = this.computeDerivedStats(equipped);

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

      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const derivedStats = this.computeDerivedStats(equipped);

      return this.formatEquippedResponse(equipped, derivedStats);
    });
  }
  
  private computeDerivedStats(equipped: Array<{ template: any; bonuses?: any }>): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const item of equipped) {
      // Use baseStats from template
      const base = (item.template?.baseStats ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(base)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
      // Use CharacterItem.bonuses (final bonuses including upgrades)
      const bonuses = (item.bonuses ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(bonuses)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
    }
    return totals;
  }
}



