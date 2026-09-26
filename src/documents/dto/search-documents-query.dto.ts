import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class SearchDocumentsQueryDto {
  @ApiProperty({
  description:
    'Vehicle Identification Number. Quick VINs to try: ' +
    '1HGCM82633A004352 (full, docs in both systems), ' +
    '5YJ3E1EA8JF000316 (sales only), ' +
    '1FTFW1ET1EFA00001 (service only), ' +
    'WBA3A5C50DF000001 (unknown VIN, empty but successful), ' +
    'FAILSERVICE000001 (Service System always 500s, call 4x to see the circuit breaker trip), ' +
    'SLOWSALES00000001 (Sales System exceeds the call timeout).',
  example: '1HGCM82633A004352',
  })
  @IsString()
  @Length(5, 17, { message: 'vin must be between 5 and 17 characters' })
  @Matches(/^[A-Z0-9]+$/i, { message: 'vin must be alphanumeric' })
  vin: string;
}
