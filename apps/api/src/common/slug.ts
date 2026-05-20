import { BadRequestException } from '@nestjs/common';

export function slugify(value: string, field = 'slug') {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new BadRequestException(
      `${field} must contain at least one letter or number`,
    );
  }

  return slug;
}
