import { IsString, Length } from 'class-validator';

export class LoginFacebookDto {
  @IsString()
  @Length(4, 64)
  playerId: string;

  @IsString()
  @Length(4, 128)
  fbUserId: string;
}
