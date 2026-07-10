import { describe, it, expect } from 'vitest';
import { slugify } from '../src/utils/parsing';

describe('slugify utility', () => {
  it('should convert standard English titles to kebab-case slugs', () => {
    expect(slugify('Hello World From Pageel')).toBe('hello-world-from-pageel');
  });

  it('should remove special characters and handle multiple spaces', () => {
    expect(slugify('My Awesome Post!!!   with symbols & stuff')).toBe('my-awesome-post-with-symbols-stuff');
  });

  it('should correctly handle Vietnamese accents and convert "đ" to "d"', () => {
    expect(slugify('Xin chào Việt Nam và miền đất mới')).toBe('xin-chao-viet-nam-va-mien-dat-moi');
  });
});
