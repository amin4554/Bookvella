export type SubmitReviewDto = {
  bookingId?: string;
  token?: string;
  rating?: number;
  comment?: string;
};

export type UpdateReviewVisibilityDto = {
  isVisible?: boolean;
};
