import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../public/partie.js', import.meta.url), 'utf8');
const start = source.indexOf("var text = svg('text'");
const labelBlock = source.slice(start, source.indexOf('});', start));

describe('dartboard number labels', () => {
  it('use a normal or medium weight, never bold', () => {
    const weight = Number(/'font-weight': '(\d+)'/.exec(labelBlock)?.[1]);
    expect(weight).toBeGreaterThanOrEqual(400);
    expect(weight).toBeLessThanOrEqual(500);
  });

  it('use a font weight that the page actually loads (Barlow 400-700)', () => {
    expect(labelBlock).toContain("'font-family': 'Barlow, sans-serif'");
  });

  it('are light on the dark rim, readable and not clickable', () => {
    expect(labelBlock).toContain("fill: '#E8E8E8'");
    expect(Number(/'font-size': '(\d+)'/.exec(labelBlock)?.[1])).toBeGreaterThanOrEqual(15);
    expect(labelBlock).toContain("'pointer-events': 'none'");
  });
});
