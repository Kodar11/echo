import { describe, expect, it } from 'vitest';
import path from 'path';
import { hasHiddenSegment, isPathInside } from './paths.js';

describe('isPathInside', () => {
  const win = path.win32;

  it('respects path boundaries on Windows', () => {
    expect(isPathInside('C:\\foo\\bar\\file.txt', 'C:\\foo\\bar', win)).toBe(true);
    expect(isPathInside('C:\\foo\\bar', 'C:\\foo\\bar', win)).toBe(true);
    expect(isPathInside('C:\\foo\\bar2\\file.txt', 'C:\\foo\\bar', win)).toBe(false);
    expect(isPathInside('C:\\foo\\barfile.txt', 'C:\\foo\\bar', win)).toBe(false);
    expect(isPathInside('C:\\foo', 'C:\\foo\\bar', win)).toBe(false);
  });

  it('is case-insensitive and separator-agnostic on Windows', () => {
    expect(isPathInside('c:/FOO/Bar/x.txt', 'C:\\foo\\bar\\', win)).toBe(true);
  });

  it('does not confuse names starting with ".." with parent traversal', () => {
    expect(isPathInside('C:\\foo\\..hidden\\x.txt', 'C:\\foo', win)).toBe(true);
  });

  it('is case-sensitive on POSIX', () => {
    const posix = path.posix;
    expect(isPathInside('/home/a/Docs/x', '/home/a/docs', posix)).toBe(false);
    expect(isPathInside('/home/a/docs/x', '/home/a/docs', posix)).toBe(true);
  });
});

describe('hasHiddenSegment', () => {
  it('only considers segments below the root', () => {
    expect(hasHiddenSegment('/home/me/.config/notes/a.txt', '/home/me/.config/notes')).toBe(false);
    expect(hasHiddenSegment('/home/me/notes/.git/HEAD', '/home/me/notes')).toBe(true);
  });
});
