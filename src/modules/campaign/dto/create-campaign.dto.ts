import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsIn,
  ArrayMaxSize,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignContactSource } from '../campaign.entity';

export class CampaignSettingsDto {
  @ApiPropertyOptional({ description: 'Min delay between messages (seconds)', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(300)
  delayMin?: number;

  @ApiPropertyOptional({ description: 'Max delay between messages (seconds)', example: 90 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(600)
  delayMax?: number;

  @ApiPropertyOptional({ description: 'Max messages per day', example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  dailyLimit?: number;

  @ApiPropertyOptional({ description: 'Max messages per hour', example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  hourlyLimit?: number;

  @ApiPropertyOptional({ description: 'Time window start (HH:MM)', example: '09:00' })
  @IsOptional()
  @IsString()
  timeWindowStart?: string;

  @ApiPropertyOptional({ description: 'Time window end (HH:MM)', example: '21:00' })
  @IsOptional()
  @IsString()
  timeWindowEnd?: string;

  @ApiPropertyOptional({ description: 'Respect business hours', example: true })
  @IsOptional()
  @IsBoolean()
  respectBusinessHours?: boolean;

  @ApiPropertyOptional({ description: 'Skip weekends', example: false })
  @IsOptional()
  @IsBoolean()
  skipWeekends?: boolean;

  @ApiPropertyOptional({ description: 'Enable warm-up mode', example: false })
  @IsOptional()
  @IsBoolean()
  warmupEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Randomize contact order', example: false })
  @IsOptional()
  @IsBoolean()
  randomizeOrder?: boolean;
}

export class CreateCampaignDto {
  @ApiProperty({ description: 'Campaign name', example: 'Summer Sale Broadcast' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Session ID to send from' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Message template with {{variable}} placeholders', example: 'Hello {{name}}, check out our offer!' })
  @IsString()
  messageTemplate: string;

  @ApiPropertyOptional({
    description: 'Message variations for spinning (rotate through these)',
    example: ['Hello {{name}}!', 'Hi {{name}}!', 'Hey {{name}}!'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  messageVariations?: string[];

  @ApiPropertyOptional({ enum: CampaignContactSource, description: 'Contact source' })
  @IsOptional()
  @IsEnum(CampaignContactSource)
  contactSource?: CampaignContactSource;

  @ApiPropertyOptional({ description: 'Contact list ID (if using existing list)' })
  @IsOptional()
  @IsString()
  contactListId?: string;

  @ApiPropertyOptional({
    description: 'Manual contact numbers (if contactSource=manual)',
    example: ['+1234567890', '+0987654321'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  manualContacts?: string[];

  @ApiPropertyOptional({ description: 'Campaign settings (delays, limits, time windows)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignSettingsDto)
  settings?: CampaignSettingsDto;

  @ApiPropertyOptional({ description: 'Schedule campaign for later (ISO date string)' })
  @IsOptional()
  @IsString()
  scheduleAt?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Message template' })
  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @ApiPropertyOptional({ description: 'Message variations' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  messageVariations?: string[];

  @ApiPropertyOptional({ description: 'Campaign settings' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignSettingsDto)
  settings?: CampaignSettingsDto;

  @ApiPropertyOptional({ description: 'Schedule date' })
  @IsOptional()
  @IsString()
  scheduleAt?: string;
}
