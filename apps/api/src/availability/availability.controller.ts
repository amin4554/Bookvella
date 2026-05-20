import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AvailabilityService } from './availability.service';
import type {
  CreateAvailabilityRuleDto,
  UpdateAvailabilityRuleDto,
} from './dto';

@Controller('availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('rules')
  list(@Req() request: AuthenticatedRequest) {
    return this.availabilityService.list(request.user!.sub);
  }

  @Post('rules')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    return this.availabilityService.create(request.user!.sub, dto);
  }

  @Patch('rules/:id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    return this.availabilityService.update(request.user!.sub, id, dto);
  }

  @Delete('rules/:id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.availabilityService.remove(request.user!.sub, id);
  }
}
