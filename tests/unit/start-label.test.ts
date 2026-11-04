import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../public/menu.js', import.meta.url), 'utf8');

type Handler = () => void;

/** Runs the setup screen script on a minimal fake page; returns the label and the type buttons. */
function loadSetupScreen() {
  const elements = new Map<string, Record<string, unknown>>();
  const element = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, {
        textContent: '',
        hidden: false,
        disabled: false,
        addEventListener() {},
        setAttribute() {},
        focus() {},
      });
    }
    return elements.get(id)!;
  };
  const typeButtons = ['x01', 'around_the_world', 'battle'].map((type) => {
    const handlers: Handler[] = [];
    return {
      dataset: { type },
      setAttribute() {},
      addEventListener: (_event: string, handler: Handler) => handlers.push(handler),
      click: () => handlers.forEach((h) => h()),
    };
  });
  const document = {
    getElementById: element,
    querySelectorAll: (selector: string) => (selector === '#game-types .mode' ? typeButtons : []),
    addEventListener() {},
  };
  const window = {
    addEventListener() {},
    crypto: { getRandomValues: (a: Uint32Array) => a },
    location: {},
  };
  vm.runInNewContext(source, { document, window, fetch: () => new Promise(() => {}) });
  return {
    label: () => element('draw-label').textContent,
    choose: (type: string) => typeButtons.find((b) => b.dataset.type === type)!.click(),
  };
}

describe('launch button label', () => {
  it('names the game type chosen, and follows the choice at once', () => {
    const screen = loadSetupScreen();
    expect(screen.label()).toBe('Start X01');
    screen.choose('around_the_world');
    expect(screen.label()).toBe('Start Tour du monde');
    screen.choose('battle');
    expect(screen.label()).toBe('Start Bataille');
    screen.choose('x01');
    expect(screen.label()).toBe('Start X01');
  });
});
