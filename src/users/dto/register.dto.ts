import { IsEnum, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CharacterTrait } from '../character-trait.enum';

class CharacterAppearanceDto {
  @IsString() gender: 'male' | 'female';
  @IsString() skinTone: string;
  @IsString() hair: string;
  @IsString() hairColor: string;
  @IsString() eyes: string;
  @IsString() mouth: string;
  @IsOptional() @IsString() beard?: string | null;
  @IsOptional() @IsString() markings?: string | null;
}

export class RegisterCharacterDto {
  @ValidateNested()
  @Type(() => CharacterAppearanceDto)
  appearance: CharacterAppearanceDto;

  @IsEnum(CharacterTrait)
  trait: CharacterTrait;
}
