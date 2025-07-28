import {
  Controller,
  Post,
  Body,
  Req,
  ForbiddenException, UseGuards,
} from '@nestjs/common';
import { RegisterService } from './register.service';
import { RegisterCharacterDto } from './dto/register.dto';
import { AuthenticatedRequest } from '@/types/auth.types';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Post()
  async register(
    @Body() body: RegisterCharacterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log("REQUEST : ",req.user)
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Unauthorized');

    return this.registerService.registerCharacter(
      userId,
      body.appearance,
      body.trait,
    );
  }
}
