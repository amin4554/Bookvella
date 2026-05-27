import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import type { ContactReportDto } from './dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('report')
  sendReport(@Body() dto: ContactReportDto) {
    return this.contactService.sendReport(dto);
  }
}
