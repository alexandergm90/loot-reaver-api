import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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

  // GET /items/:id: get item details by characterItem.id
  @UseGuards(JwtAuthGuard)
  @Get('items/:id')
  async getItemDetails(@Req() req: AuthenticatedRequest, @Param('id') itemId: string) {
    return this.character.getItemDetails(req.user.id, itemId);
  }

  // POST /equipment/equip: equip item and return updated equipped + derived stats
  @UseGuards(JwtAuthGuard)
  @Post('equipment/equip')
  async equip(@Req() req: AuthenticatedRequest, @Body() body: EquipItemDto) {
    return this.character.equipItem(req.user.id, body.itemId, body.slot);
  }

  // POST /equipment/unequip: unequip item and return updated equipped + derived stats
  @UseGuards(JwtAuthGuard)
  @Post('equipment/unequip')
  async unequip(@Req() req: AuthenticatedRequest, @Body() body: EquipItemDto) {
    return this.character.unequipItem(req.user.id, body.itemId);
  }

  // POST /items/use: placeholder for consumables
  @UseGuards(JwtAuthGuard)
  @Post('items/use')
  async useItem() {
    return { ok: true };
  }
}


