import { IsString, Length } from 'class-validator';

export class LoginGuestDto {
  @IsString()
  @Length(4, 64)
  playerId: string;
}
