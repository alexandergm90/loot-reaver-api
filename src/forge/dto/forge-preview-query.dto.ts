import { IsString, IsNotEmpty } from 'class-validator';

export class ForgePreviewQueryDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;
}

