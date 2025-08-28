import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CharacterService } from './character.service';
import { AuthenticatedRequest } from '@/types/auth.types';
import { EquipItemDto } from './dto/equip-item.dto';

@Controller('player')
export class CharacterController {
  constructor(private readonly character: CharacterService) {}

  // GET /character: profile + equipped items + derived stats
  @UseGuards(JwtAuthGuard)
  @Get('character')
  async getCharacter(@Req() req: AuthenticatedRequest) {
    const data = await this.character.getCharacterWithEquipment(req.user.id);
    return data ?? {};
  }


  // GET /inventory: non-equipped items
  @UseGuards(JwtAuthGuard)
  @Get('inventory')
  async getInventory(@Req() req: AuthenticatedRequest) {
    return this.character.getInventory(req.user.id);
  }

  // POST /equipment/equip: equip item and return updated equipped + derived stats
  @UseGuards(JwtAuthGuard)
  @Post('equipment/equip')
  async equip(@Req() req: AuthenticatedRequest, @Body() body: EquipItemDto) {
    return this.character.equipItem(req.user.id, body.itemId, body.slot);
  }

  // POST /items/use: placeholder for consumables
  @UseGuards(JwtAuthGuard)
  @Post('items/use')
  async useItem() {
    return { ok: true };
  }
}


