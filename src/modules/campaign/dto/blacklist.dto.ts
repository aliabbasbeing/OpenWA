import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { BlacklistReason } from '../blacklist.entity';

export class AddToBlacklistDto {
  @ApiProperty({ description: 'Phone number in international format', example: '+1234567890' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ enum: BlacklistReason, description: 'Reason for blacklisting' })
  @IsOptional()
  @IsEnum(BlacklistReason)
  reason?: BlacklistReason;

  @ApiPropertyOptional({ description: 'Session ID (optional, for session-specific blacklist)' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ImportBlacklistDto {
  @ApiProperty({
    description: 'Array of phone numbers to blacklist',
    example: ['+1234567890', '+0987654321'],
  })
  @IsArray()
  @IsString({ each: true })
  numbers: string[];

  @ApiPropertyOptional({ description: 'Session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ enum: BlacklistReason, description: 'Reason for all entries' })
  @IsOptional()
  @IsEnum(BlacklistReason)
  reason?: BlacklistReason;
}
