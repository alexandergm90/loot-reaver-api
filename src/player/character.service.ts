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

      // Validation: Check if item is already equipped
      if (item.equipped) {
        // If slot is provided and matches, or no slot provided, it's already equipped correctly
        if (!slot || slot === item.slot) {
          // Already equipped in the correct slot, return current state
          const equipped = await tx.characterItem.findMany({
            where: { characterId: item.character.id, equipped: true },
            include: { template: true },
          });
          const derivedStats = this.computeDerivedStats(equipped);
          return {
            equipped: equipped.map((e) => ({
              id: e.id,
              slot: e.slot,
              rarity: e.rarity,
              code: e.template.code,
              template: e.template,
            })),
            derivedStats,
          };
        } else {
          throw new BadRequestException('Item is already equipped in a different slot');
        }
      }

      // Validation: Check if item is in inventory (not equipped)
      // This is already checked above, but keeping for clarity

      // Determine the slot to use: provided slot (for left/right sub-slots) or item's slot from template
      // Note: slot parameter is for sub-slots (left/right) when dual wielding weapons or equipping two rings
      const targetSlot: ItemSlot = item.slot;

      // Unequip any currently equipped items in the same slot
      await tx.characterItem.updateMany({
        where: { characterId: item.character.id, slot: targetSlot, equipped: true },
        data: { equipped: false },
      });

      // Equip the requested item
      await tx.characterItem.update({ where: { id: item.id }, data: { equipped: true } });

      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const derivedStats = this.computeDerivedStats(equipped);

      return {
        equipped: equipped.map((e) => ({
          id: e.id,
          slot: e.slot,
          rarity: e.rarity,
          code: e.template.code,
          template: e.template,
        })),
        derivedStats,
      };
    });
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
      await tx.characterItem.update({ where: { id: item.id }, data: { equipped: false } });

      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const derivedStats = this.computeDerivedStats(equipped);

      return {
        equipped: equipped.map((e) => ({
          id: e.id,
          slot: e.slot,
          rarity: e.rarity,
          code: e.template.code,
          template: e.template,
        })),
        derivedStats,
      };
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



