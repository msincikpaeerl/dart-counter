import { describe, expect, it } from 'vitest';
import { migrations } from '../../src/server/migrations.js';

describe('migration list', () => {
  it('has unique names in ascending order', () => {
    const names = migrations.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(names);
  });

  it('is not empty and each migration has SQL', () => {
    expect(migrations.length).toBeGreaterThan(0);
    for (const m of migrations) expect(m.sql.trim()).not.toBe('');
  });
});
