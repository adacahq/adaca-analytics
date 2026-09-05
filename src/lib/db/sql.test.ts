import { describe, expect, it } from 'vitest';
import { ident, lit, num } from './sql';

describe('sql literals', () => {
  it('quotes strings and doubles embedded quotes', () => {
    expect(lit('hello')).toBe("'hello'");
    expect(lit("O'Brien's")).toBe("'O''Brien''s'");
    expect(lit(`'; DROP TABLE rollups; --`)).toBe(`'''; DROP TABLE rollups; --'`);
  });

  it('leaves backslashes alone and strips NULs', () => {
    expect(lit('a\\b')).toBe("'a\\b'");
    expect(lit('a\0b')).toBe("'ab'");
  });

  it('handles null and empty', () => {
    expect(lit(null)).toBe('NULL');
    expect(lit(undefined)).toBe('NULL');
    expect(lit('')).toBe("''");
  });

  it('formats numbers defensively', () => {
    expect(num(12)).toBe('12');
    expect(num(1.23456)).toBe('1.235');
    expect(num(NaN)).toBe('0');
    expect(num(Infinity)).toBe('0');
    expect(num(null)).toBe('0');
  });

  it('rejects unsafe identifiers', () => {
    expect(ident('users')).toBe('users');
    expect(() => ident('users; drop')).toThrow();
  });
});
