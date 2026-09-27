import { expect, test, type Page } from '@playwright/test';

// Headless Chromium hides scrollbars by default; Editor 2's overlay must line up with them showing, as in a real browser.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SimuProc/);
});

async function openEditor2(page: Page): Promise<void> {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await page.getByTestId('tab-editor2').click();
  await expect(page.getByTestId('editor2-text')).toBeVisible();
}

/** The textarea of Editor 2 and the highlighted <pre> drawn under it. */
function editor2Layers(page: Page) {
  const text = page.getByTestId('editor2-text');
  return { text, overlay: page.getByTestId('win-editor').locator('pre[aria-hidden="true"]') };
}

test('Editor 2: el texto editable y el resaltado usan la misma fuente monoespaciada', async ({ page }) => {
  await openEditor2(page);
  const { text, overlay } = editor2Layers(page);
  await text.fill('JMP 01F ; iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii');
  const font = (el: Element) => getComputedStyle(el).fontFamily;
  expect(await text.evaluate(font)).toBe(await overlay.evaluate(font));
  expect(await text.evaluate(font)).toContain('monospace');
  expect(await text.evaluate((el) => el.scrollWidth)).toBe(await overlay.evaluate((el) => el.scrollWidth));
});

test('Editor 2: el menú "Agregar Instrucción" cabe entero en la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEditor2(page);
  const { text } = editor2Layers(page);
  // A right-click low on the screen, as a real MouseEvent (Playwright's dispatchEvent sends a plain Event).
  await text.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 1000, clientY: 700, button: 2 }));
  });
  const menu = page.getByTestId('win-editor').getByRole('menu');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  if (!box) throw new Error('sin menú');
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(768);
  expect(box.x + box.width).toBeLessThanOrEqual(1024);
  for (const name of ['HLT', 'FTOI', 'NOP']) {
    await expect(menu.getByRole('menuitem', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  await menu.getByRole('menuitem', { name: 'HLT', exact: true }).click();
  await expect(text).toHaveValue(/^HLT /);
});

test('Editor 2: el menú "Agregar Instrucción" no se estrecha cerca del borde derecho', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEditor2(page);
  const { text } = editor2Layers(page);
  const menu = page.getByTestId('win-editor').getByRole('menu');
  const openAt = async (clientX: number) => {
    await text.evaluate((el, x) => {
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: 100, button: 2 }));
    }, clientX);
    await expect(menu).toBeVisible();
    return menu.evaluate((el) => {
      const grid = el.querySelector('.grid') as HTMLElement;
      return { width: el.getBoundingClientRect().width, gridClient: grid.clientWidth, gridScroll: grid.scrollWidth, scroll: el.scrollWidth, client: el.clientWidth };
    });
  };
  // The right edge first, then a reopening far from it: neither may inherit a size from where it was laid out.
  const right = await openAt(1000);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  const left = await openAt(100);
  expect(right.width).toBe(left.width);
  // No column spills into the next one and the menu never scrolls sideways.
  for (const m of [left, right]) {
    expect(m.gridScroll).toBeLessThanOrEqual(m.gridClient);
    expect(m.scroll).toBeLessThanOrEqual(m.client);
  }
  for (const name of ['FTOI', 'PUSH']) {
    const item = menu.getByRole('menuitem', { name, exact: true });
    expect(await item.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
});

test('Editor 2: el resaltado sigue al texto hasta el final del desplazamiento', async ({ page }) => {
  await openEditor2(page);
  const { text, overlay } = editor2Layers(page);
  const lines = Array.from({ length: 80 }, (_, i) => `MOV AX,${i}`);
  lines[40] = `MSG ${'x'.repeat(300)}`;
  await text.fill(lines.join('\n'));
  await text.evaluate((el) => {
    el.scrollTop = 1e6;
    el.scrollLeft = 1e6;
  });
  const offsets = (el: Element) => [el.scrollTop, el.scrollLeft];
  const end = await text.evaluate(offsets);
  expect(end[0]).toBeGreaterThan(0);
  expect(end[1]).toBeGreaterThan(0);
  await expect.poll(() => overlay.evaluate(offsets)).toEqual(end);
});
