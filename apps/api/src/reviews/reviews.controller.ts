import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { SubmitReviewDto, UpdateReviewVisibilityDto } from './dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('public/reviews')
  submitPublicReview(@Body() dto: SubmitReviewDto) {
    return this.reviewsService.submitPublicReview(dto);
  }

  @Get('reviews')
  @UseGuards(AuthGuard)
  listHostReviews(@Req() request: AuthenticatedRequest) {
    return this.reviewsService.listHostReviews(request.user!.sub);
  }

  @Patch('reviews/:id/visibility')
  @UseGuards(AuthGuard)
  updateVisibility(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateReviewVisibilityDto,
  ) {
    return this.reviewsService.updateVisibility(request.user!.sub, id, dto);
  }
}
