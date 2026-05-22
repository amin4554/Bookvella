import { BadRequestException } from '@nestjs/common';
import {
  optionalNonNegativeInteger,
  optionalText,
  requirePositiveInteger,
  requireText,
} from './validation';

describe('requireText', () => {
  it('returns trimmed value', () => {
    expect(requireText('  hello  ', 'field')).toBe('hello');
  });

  it('throws on empty string', () => {
    expect(() => requireText('', 'name')).toThrow(BadRequestException);
  });

  it('throws on whitespace-only string', () => {
    expect(() => requireText('   ', 'name')).toThrow(BadRequestException);
  });

  it('throws on undefined', () => {
    expect(() => requireText(undefined, 'name')).toThrow(BadRequestException);
  });
});

describe('optionalText', () => {
  it('returns null for empty string', () => {
    expect(optionalText('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(optionalText('   ')).toBeNull();
  });

  it('returns null for null', () => {
    expect(optionalText(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(optionalText(undefined)).toBeNull();
  });

  it('returns trimmed text when present', () => {
    expect(optionalText('  hello  ')).toBe('hello');
  });
});

describe('requirePositiveInteger', () => {
  it('returns the value', () => {
    expect(requirePositiveInteger(3, 'count')).toBe(3);
  });

  it('throws on zero', () => {
    expect(() => requirePositiveInteger(0, 'count')).toThrow(BadRequestException);
  });

  it('throws on negative', () => {
    expect(() => requirePositiveInteger(-1, 'count')).toThrow(BadRequestException);
  });

  it('throws on undefined', () => {
    expect(() => requirePositiveInteger(undefined, 'count')).toThrow(BadRequestException);
  });

  it('throws on float', () => {
    expect(() => requirePositiveInteger(1.5, 'count')).toThrow(BadRequestException);
  });

  it('throws when value exceeds max', () => {
    expect(() => requirePositiveInteger(6, 'rating', { max: 5 })).toThrow(BadRequestException);
  });

  it('accepts value equal to max', () => {
    expect(requirePositiveInteger(5, 'rating', { max: 5 })).toBe(5);
  });
});

describe('optionalNonNegativeInteger', () => {
  it('returns undefined for undefined', () => {
    expect(optionalNonNegativeInteger(undefined, 'field')).toBeUndefined();
  });

  it('returns zero', () => {
    expect(optionalNonNegativeInteger(0, 'field')).toBe(0);
  });

  it('returns a positive value', () => {
    expect(optionalNonNegativeInteger(10, 'field')).toBe(10);
  });

  it('throws on negative', () => {
    expect(() => optionalNonNegativeInteger(-1, 'field')).toThrow(BadRequestException);
  });

  it('throws on float', () => {
    expect(() => optionalNonNegativeInteger(1.5, 'field')).toThrow(BadRequestException);
  });

  it('throws when value exceeds max', () => {
    expect(() => optionalNonNegativeInteger(10, 'field', { max: 5 })).toThrow(BadRequestException);
  });

  it('accepts value equal to max', () => {
    expect(optionalNonNegativeInteger(5, 'field', { max: 5 })).toBe(5);
  });
});
