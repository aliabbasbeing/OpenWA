import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsIn } from 'class-validator';

export class UpdateAutoRestartDto {
  @ApiProperty({ description: 'Enable or disable auto-restart', example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Restart interval in hours (1, 2, 4, 8, 12, or 24)',
    example: 24,
    enum: [1, 2, 4, 8, 12, 24],
  })
  @IsOptional()
  @IsIn([0.033, 1, 2, 4, 8, 12, 24])
  intervalHours?: number;
}
