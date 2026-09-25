import { IsString, Length, Matches } from 'class-validator';

export class SearchDocumentsQueryDto {
  @IsString()
  @Length(5, 17, { message: 'vin must be between 5 and 17 characters' })
  @Matches(/^[A-Z0-9]+$/i, { message: 'vin must be alphanumeric' })
  vin: string;
}
