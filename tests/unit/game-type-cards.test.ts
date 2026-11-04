import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../public/menu.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');

describe('game type cards', () => {
  it('still shows the three game types', () => {
    const block = html.slice(html.indexOf('id="game-types"'));
    expect(block).toContain('>X01<');
    expect(block).toContain('>Tour<');
    expect(block).toContain('>Bataille<');
  });

  it('sizes the title from the card width so it stays inside the square', () => {
    expect(css).toMatch(/#game-types \.mode\s*\{[^}]*container-type:\s*inline-size/);
    expect(css).toMatch(/#game-types \.mode\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/#game-types \.mode-num\s*\{[^}]*font-size:\s*min\(56px,\s*26cqw\)/);
    expect(css).toMatch(/#game-types \.mode-num\s*\{[^}]*font-size:\s*min\(84px,\s*26cqw\)/);
  });
});
