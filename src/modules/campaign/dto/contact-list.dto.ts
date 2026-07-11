import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ContactListSource } from '../contact-list.entity';

export class CreateContactListDto {
  @ApiProperty({ description: 'Contact list name', example: 'VIP Customers' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Contact list description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Session ID (optional, for WhatsApp-sourced contacts)' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ enum: ContactListSource, description: 'Contact source' })
  @IsOptional()
  @IsEnum(ContactListSource)
  source?: ContactListSource;

  @ApiPropertyOptional({
    description: 'Contact entries with number, name, and optional variables',
    example: [
      { number: '+1234567890', name: 'John', variables: { company: 'Acme' } },
      { number: '+0987654321', name: 'Jane' },
    ],
  })
  @IsOptional()
  @IsArray()
  contacts?: Array<{ number: string; name?: string; variables?: Record<string, string> }>;
}

export class ImportCsvContactListDto {
  @ApiProperty({ description: 'Contact list name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    description: 'CSV data as array of objects (parsed on frontend)',
    example: [
      { phone: '+1234567890', name: 'John' },
      { phone: '+0987654321', name: 'Jane' },
    ],
  })
  @IsArray()
  data: Array<Record<string, string>>;

  @ApiProperty({ description: 'Column name that contains phone numbers' })
  @IsString()
  phoneColumn: string;

  @ApiPropertyOptional({ description: 'Column name that contains names' })
  @IsOptional()
  @IsString()
  nameColumn?: string;

  @ApiPropertyOptional({
    description: 'Additional column mappings for template variables',
    example: { company: 'Company', city: 'City' },
  })
  @IsOptional()
  variableColumns?: Record<string, string>;
}

export class ExtractFromSessionDto {
  @ApiProperty({ description: 'WhatsApp session ID to extract chats from' })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({ description: 'Name for the new contact list' })
  @IsOptional()
  @IsString()
  name?: string;
}
