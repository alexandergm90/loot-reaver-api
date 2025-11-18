import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

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

    const derivedStats = this.computeDerivedStats(character.items.map((i) => ({
      id: i.id,
      slot: i.slot,
      template: i.template as any,
    })));

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

  async equipItem(userId: string, itemId: string, providedSubslot?: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.characterItem.findFirst({
        where: { id: itemId },
        include: { template: true, character: { select: { id: true, userId: true } } },
      });
      if (!item) throw new NotFoundException('Item not found');
      if (item.character.userId !== userId) throw new ForbiddenException('Cannot equip item you do not own');

      // For now, treat each slot as unique (no dual wield/ring-hand differentiation yet)
      // Future: use providedSubslot for weapon/ring when schema supports sub-slots.
      const slot = item.slot;

      // Unequip any currently equipped items in the same slot
      await tx.characterItem.updateMany({
        where: { characterId: item.character.id, slot, equipped: true },
        data: { equipped: false },
      });

      // Equip the requested item
      await tx.characterItem.update({ where: { id: item.id }, data: { equipped: true } });

      // Return updated equipment + derived stats
      const equipped = await tx.characterItem.findMany({
        where: { characterId: item.character.id, equipped: true },
        include: { template: true },
      });

      const derivedStats = this.computeDerivedStats(
        equipped.map((e) => ({ id: e.id, slot: e.slot, template: e.template as any }))
      );

      return {
        equipped: equipped.map((e) => ({ id: e.id, slot: e.slot, template: e.template })),
        derivedStats,
      };
    });
  }
  
  private computeDerivedStats(equipped: Array<{ id: string; slot: string; template: any }>): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const item of equipped) {
      const base = (item.template?.baseStats ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(base)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
      const bonuses = (item.template?.bonuses ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(bonuses)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
    }
    return totals;
  }
}



