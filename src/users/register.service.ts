import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CharacterDraft } from '@/types/character.types';
import { CharacterTrait } from './character-trait.enum';

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

    // Generate random name + title
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
            // Initialize rune system: base 4 capacity, full runes on start
            runeCapacityBase: 4,
            runeCapacityBonus: 0,
            runeRegenBaseSeconds: 1800,
            runeRegenMultiplier: 1000,
            runeRegenAddSeconds: 0,
            runes: 4,
            mirrorShards: 0,
          },
        },

        stats: {
          create: {}, // all fields default to 0
        },
      },

      include: {
        appearance: true,
        resources: true,
        stats: true,
      },
    });

    return {
      id: character.id,
      name: character.name,
      title: character.title,
      trait: character.trait,
      appearance: character.appearance,
      resources: character.resources,
    };
  }
}
