import {
  Controller,
  Post,
  Body,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { RegisterService } from './register.service';
import { RegisterCharacterDto } from './dto/register.dto';
import { AuthenticatedRequest } from '@/types/auth.types';

@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Post()
  async register(
    @Body() body: RegisterCharacterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Unauthorized');

    return this.registerService.registerCharacter(
      userId,
      body.appearance,
      body.trait,
    );
  }
}
