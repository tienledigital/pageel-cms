import { describe, it, expect } from 'vitest';
import { isPathAllowed, normalizePath, getMimeType } from '../src/lib/proxy-utils';

describe('normalizePath', () => {
  it('should normalize paths correctly', () => {
    expect(normalizePath('a/b/c')).toBe('a/b/c');
    expect(normalizePath('a/../b')).toBe('b');
    expect(normalizePath('a/./b')).toBe('a/b');
    expect(normalizePath('a/b/../../c')).toBe('c');
  });
});

describe('getMimeType', () => {
  it('should return correct mime type for known extensions', () => {
    expect(getMimeType('test.jpg')).toBe('image/jpeg');
    expect(getMimeType('test.png')).toBe('image/png');
    expect(getMimeType('test.json')).toBe('application/json');
    expect(getMimeType('test.md')).toBe('text/markdown');
  });

  it('should return fallback mime type for unknown extensions', () => {
    expect(getMimeType('test.unknown')).toBe('application/octet-stream');
    expect(getMimeType('test')).toBe('application/octet-stream');
  });
});

// @para-doc [#csa-cms-path-val-unit-tests]
describe('isPathAllowed', () => {
  describe('blob context (strictest/default)', () => {
    it('should allow public fallback paths', () => {
      expect(isPathAllowed('public/images/logo.png', 'blob')).toBe(true);
      expect(isPathAllowed('images/logo.png', 'blob')).toBe(true);
    });

    it('should block all src directory access', () => {
      expect(isPathAllowed('src/content/blog/post.md', 'blob')).toBe(false);
      expect(isPathAllowed('src/lib/proxy-utils.ts', 'blob')).toBe(false);
    });

    it('should block sensitive configuration and hidden files', () => {
      expect(isPathAllowed('.env', 'blob')).toBe(false);
      expect(isPathAllowed('.env.local', 'blob')).toBe(false);
      expect(isPathAllowed('.git/config', 'blob')).toBe(false);
    });

    it('should block path traversals', () => {
      expect(isPathAllowed('../etc/passwd', 'blob')).toBe(false);
      expect(isPathAllowed('src/../../etc/passwd', 'blob')).toBe(false);
    });

    it('should block URL encoded path traversals', () => {
      expect(isPathAllowed('src%2F..%2F..%2Fetc%2Fpasswd', 'blob')).toBe(false);
    });
    
    it('should handle decoding failure', () => {
      expect(isPathAllowed('src/%E0%A4%A', 'blob')).toBe(false);
    });
  });

  describe('cms-read context', () => {
    it('should allow astro content collections and content layer directories', () => {
      expect(isPathAllowed('src/content/blog/post.md', 'cms-read')).toBe(true);
      expect(isPathAllowed('src/data/settings.json', 'cms-read')).toBe(true);
      expect(isPathAllowed('src/assets/logo.png', 'cms-read')).toBe(true);
    });

    it('should block code/script files inside content directories', () => {
      expect(isPathAllowed('src/content/blog/script.js', 'cms-read')).toBe(false);
      expect(isPathAllowed('src/content/blog/style.ts', 'cms-read')).toBe(false);
    });

    it('should block general src source code', () => {
      expect(isPathAllowed('src/lib/proxy-utils.ts', 'cms-read')).toBe(false);
      expect(isPathAllowed('src/components/Sidebar.tsx', 'cms-read')).toBe(false);
    });

    it('should block sensitive files and traversals', () => {
      expect(isPathAllowed('.env', 'cms-read')).toBe(false);
      expect(isPathAllowed('src/content/../../.env', 'cms-read')).toBe(false);
      expect(isPathAllowed('src%2Fcontent%2F%2E%2E%2F%2E%2E%2F%2Eenv', 'cms-read')).toBe(false);
    });
  });

  describe('cms-write context', () => {
    it('should allow writing to content directories', () => {
      expect(isPathAllowed('src/content/blog/new-post.md', 'cms-write')).toBe(true);
      expect(isPathAllowed('src/data/new-data.json', 'cms-write')).toBe(true);
    });

    it('should block writing code/script files inside content directories', () => {
      expect(isPathAllowed('src/content/blog/evil.js', 'cms-write')).toBe(false);
      expect(isPathAllowed('src/content/blog/evil.ts', 'cms-write')).toBe(false);
    });

    it('should block writing to general src code files', () => {
      expect(isPathAllowed('src/lib/proxy-utils.ts', 'cms-write')).toBe(false);
      expect(isPathAllowed('src/components/Sidebar.tsx', 'cms-write')).toBe(false);
    });

    it('should block sensitive configuration and traversals', () => {
      expect(isPathAllowed('.env.local', 'cms-write')).toBe(false);
      expect(isPathAllowed('src/content/../../.git/config', 'cms-write')).toBe(false);
    });
  });
});
