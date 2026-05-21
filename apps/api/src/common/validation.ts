import { BadRequestException } from '@nestjs/common';

export function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required`);
  }

  return text;
}

export function optionalText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export function requirePositiveInteger(
  value: number | undefined,
  field: string,
  options: { max?: number } = {},
): number {
  if (value === undefined) {
    throw new BadRequestException(`${field} is required`);
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new BadRequestException(
      `${field} cannot be greater than ${options.max}`,
    );
  }

  return value;
}

export function optionalNonNegativeInteger(
  value: number | undefined,
  field: string,
  options: { max?: number } = {},
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new BadRequestException(
      `${field} cannot be greater than ${options.max}`,
    );
  }

  return value;
}
