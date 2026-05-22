import { BadRequestException } from '@nestjs/common';
import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('collapses multiple separators into one hyphen', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  -foo-  ')).toBe('foo');
  });

  it('handles apostrophes and special characters', () => {
    expect(slugify("John O'Brien")).toBe('john-o-brien');
  });

  it('preserves numbers', () => {
    expect(slugify('Session 101')).toBe('session-101');
  });

  it('throws when input produces an empty slug', () => {
    expect(() => slugify('---')).toThrow(BadRequestException);
  });

  it('throws on whitespace-only input', () => {
    expect(() => slugify('   ')).toThrow(BadRequestException);
  });

  it('throws on empty string', () => {
    expect(() => slugify('')).toThrow(BadRequestException);
  });
});
