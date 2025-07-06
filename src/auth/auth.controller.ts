import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UseGuards, Get, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginGuestDto } from './dto/login-guest.dto';
import { LoginFacebookDto } from './dto/login-facebook.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('guest')
  loginGuest(@Body() body: LoginGuestDto) {
    return this.authService.loginGuest(body.playerId);
  }

  @Post('facebook')
  loginFacebook(@Body() body: LoginFacebookDto) {
    return this.authService.loginFacebook(body.playerId, body.fbUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: { user: { userId: string } }) {
    return {
      userId: req.user.userId,
    };
  }
}
