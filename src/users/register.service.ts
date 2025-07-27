import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CharacterDraft } from '@/types/character.types';
import { CharacterTrait } from '@prisma/client';

@Injectable()
export class RegisterService {
  constructor(private readonly prisma: PrismaService) {}

  async registerCharacter(
    userId: string,
    appearance: CharacterDraft,
    trait: string,
  ) {
    const existingCharacter = await this.prisma.character.findFirst({
      where: { userId },
    });

    if (existingCharacter) {
      throw new BadRequestException('Character already exists');
    }

    // Generate random name + title (you can replace this logic)
    const randomName = 'Wanderer' + Math.floor(Math.random() * 100000);
    const title = 'The Untested';

    const character = await this.prisma.character.create({
      data: {
        user: { connect: { id: userId } },
        name: randomName,
        title,
        trait: trait as CharacterTrait,
        hasCharacter: true,

        appearance: {
          create: {
            gender: appearance.gender,
            skinTone: appearance.skinTone,
            hair: appearance.hair,
            hairColor: appearance.hairColor,
            eyes: appearance.eyes,
            mouth: appearance.mouth,
            beard: appearance.beard,
            markings: appearance.markings,
          },
        },

        resources: {
          create: {
            gold: 100,
            scrap: 50,
            runes: 5,
            mirrorShards: 1,
          },
        },

        stats: {
          create: {}, // all fields default to 0
        },

        items: {
          create: [
            {
              template: { connect: { code: 'starter_sword' } },
              slot: 'weapon',
              equipped: true,
            },
            {
              template: { connect: { code: 'starter_chest' } },
              slot: 'chest',
              equipped: true,
            },
          ],
        },
      },

      include: {
        appearance: true,
        resources: true,
        stats: true,
        items: {
          include: { template: true },
        },
      },
    });

    return {
      id: character.id,
      name: character.name,
      title: character.title,
      trait: character.trait,
      appearance: character.appearance,
      resources: character.resources,
      items: character.items.map((i) => ({
        id: i.id,
        slot: i.slot,
        equipped: i.equipped,
        template: i.template,
      })),
    };
  }
}
