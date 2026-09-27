import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

/** Custom properties declared in one `:root { ... }` body. */
function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = tokens(/^:root\s*\{([^}]*)\}/m.exec(css)![1]);
const dark = { ...light, ...tokens(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)![1]) };

/** WCAG 2.x relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every #rrggbb color a CSS value resolves to in a theme (all the stops of a gradient). */
function colors(value: string, theme: Record<string, string>): string[] {
  const resolved = value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => theme[name] ?? name);
  return resolved.match(/#[0-9a-f]{6}\b/gi) ?? [];
}

/** Rules that put `--accent-text` over their own background: [selector, background]. */
const accentTextRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => /(^|[;\s])color:\s*var\(--accent-text\)/.test(m[2]))
  .map((m) => [m[1].trim(), /background:\s*([^;]+);/.exec(m[2])?.[1] ?? ''] as const);

describe('Contraste del texto sobre el color de acento (WCAG AA 4.5:1)', () => {
  it('finds the rules that use --accent-text', () => {
    expect(accentTextRules.map(([sel]) => sel)).toEqual(
      expect.arrayContaining(['.btn-primary', '.win-title', '.flag[data-on="1"]', '.menu-item:hover:not(:disabled)']),
    );
  });

  for (const [name, theme] of [
    ['claro', light],
    ['oscuro', dark],
  ] as const) {
    it(`tema ${name}: every background behind --accent-text reaches 4.5:1`, () => {
      for (const [selector, background] of accentTextRules) {
        const stops = colors(background, theme);
        expect(stops.length, selector).toBeGreaterThan(0);
        for (const stop of stops) {
          expect(contrast(stop, theme['--accent-text']), `${selector} ${stop}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
