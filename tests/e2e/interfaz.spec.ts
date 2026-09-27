import { expect, test, type Page } from '@playwright/test';
import { closeDialog, loadProgram } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SimuProc/);
});

/** True when the focused element is inside the element with this test id. */
function focusInside(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((id) => !!document.activeElement?.closest(`[data-testid="${id}"]`), testId);
}

test('Entrada manual: una dirección no válida no escribe nada y deja el error visible', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-manual').click();
  await page.getByTestId('manual-list').selectOption('99');
  await page.getByTestId('manual-addr').fill('G00');
  await page.getByTestId('manual-addr').press('Enter');
  await expect(page.getByTestId('manual-error')).toHaveText('Valor Hexa no Válido, entre valores solo entre 0-9 y A-F');
  await expect(page.getByTestId('manual-addr')).toHaveValue('G00');
  await expect(page.getByTestId('mem-000')).toHaveText(/0000000000000000/);
  await page.getByTestId('manual-addr').fill('1000');
  await page.getByTestId('manual-ok').click();
  await expect(page.getByTestId('manual-error')).toHaveText('Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF');
  await expect(page.getByTestId('mem-000')).toHaveText(/0000000000000000/);
  await expect(page.getByTestId('mem-001')).toHaveText(/0000000000000000/);
  await page.getByTestId('manual-addr').fill('010');
  await page.getByTestId('manual-addr').press('Enter');
  await expect(page.getByTestId('manual-error')).toHaveText('');
  await expect(page.getByTestId('status')).toHaveText('Se añadió la instrucción: HLT');
  await expect(page.getByTestId('mem-010')).toContainText('HLT');
  await expect(page.getByTestId('manual-addr')).toHaveValue('011');
});

test('Una ventana flotante vuelve a la pantalla cuando el navegador se achica', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.getByTestId('menu-simulacion').click();
  await page.getByTestId('menu-estadisticas').click();
  const win = page.getByTestId('win-stats');
  await expect(win).toBeVisible();
  const title = win.locator('.win-title');
  const box = await title.boundingBox();
  if (!box) throw new Error('sin título');
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(1590, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  expect((await win.boundingBox())?.x).toBeGreaterThan(1400);
  await page.setViewportSize({ width: 800, height: 900 });
  await expect.poll(async () => (await win.boundingBox())?.x ?? Infinity).toBeLessThanOrEqual(800 - 120);
  // The visible part of the title bar is enough to drag it back and reach the close button.
  const back = await title.boundingBox();
  if (!back) throw new Error('sin título');
  await page.mouse.move(back.x + 20, back.y + back.height / 2);
  await page.mouse.down();
  await page.mouse.move(40, back.y + back.height / 2, { steps: 10 });
  await page.mouse.up();
  await closeDialog(page, 'win-stats');
});

test('Los diálogos modales reciben el foco, lo retienen con Tab y lo devuelven al cerrar', async ({ page }) => {
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('msgbox-message')).toContainText('No hay ningun Programa en la Memoria!!');
  expect(await focusInside(page, 'msgbox')).toBe(true);
  for (const key of ['Shift+Tab', 'Shift+Tab', 'Tab', 'Tab', 'Tab']) {
    await page.keyboard.press(key);
    expect(await focusInside(page, 'msgbox'), key).toBe(true);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('msgbox')).toBeHidden();
  await expect(page.getByTestId('btn-ejecutar')).toBeFocused();

  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-conversion').click();
  await expect(page.getByTestId('dlg-bases')).toBeVisible();
  await expect.poll(() => focusInside(page, 'dlg-bases')).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.classList.contains('win-close'))).toBe(false);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    expect(await focusInside(page, 'dlg-bases'), `pulsación ${i}`).toBe(true);
  }
});

test('Escape cierra solo el diálogo de arriba; un mensaje pendiente no deja cerrar el de abajo', async ({ page }) => {
  await loadProgram(page, 'NOP\nPOP AX\nHLT');
  await page.getByTestId('speed').fill('0');
  await page.getByTestId('btn-ejecutar').click();
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-conversion').click();
  await expect(page.getByTestId('dlg-bases')).toBeVisible();
  await expect(page.getByTestId('msgbox-message')).toContainText('POP');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('msgbox')).toBeVisible();
  await expect(page.getByTestId('dlg-bases')).toBeVisible();
  await page.getByTestId('msgbox-btn-No').click();
  await expect(page.getByTestId('msgbox')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dlg-bases')).toBeHidden();
});

test('Los flags se fuerzan con doble clic o con el teclado, no con un clic', async ({ page }) => {
  const z = page.getByTestId('flag-Z');
  await z.click();
  await expect(z).toHaveText('0');
  await z.dblclick();
  await expect(z).toHaveText('1');
  await z.dblclick();
  await expect(z).toHaveText('0');
  for (const name of ['N', 'C', 'O']) {
    const flag = page.getByTestId(`flag-${name}`);
    await flag.click();
    await expect(flag).toHaveText('0');
    await flag.dblclick();
    await expect(flag).toHaveText('1');
  }
  await z.focus();
  await page.keyboard.press('Enter');
  await expect(z).toHaveText('1');
  await page.keyboard.press(' ');
  await expect(z).toHaveText('0');
});

test('El monitor de E/S no salta al final mientras se escribe en el Teclado', async ({ page }) => {
  const lines = Array.from({ length: 40 }, (_, i) => `MSG linea ${i}`).join('\n');
  await loadProgram(page, `${lines}\nLDT dato\nEAP fin\nHLT`);
  await page.getByTestId('animation').uncheck();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('input-prompt')).toHaveText('dato');
  const monitor = page.getByTestId('monitor');
  await expect(monitor).toContainText('linea 39');
  await monitor.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.getByTestId('input-teclado').pressSequentially('5');
  await expect(page.getByTestId('input-teclado')).toHaveValue('5');
  expect(await monitor.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByTestId('btn-entrar-dato').click();
  await expect(monitor).toContainText('fin');
  await expect
    .poll(() => monitor.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 4))
    .toBe(true);
});

test('Modificar Memoria: el flag N lleva el caption del original', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-modificar').click();
  await expect(page.getByTestId('dlg-modify').getByLabel('N (Negative ó Sign Flag)')).toBeVisible();
  await expect(page.getByTestId('dlg-modify')).not.toContainText('N (Negative Flag)');
});
