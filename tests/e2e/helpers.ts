import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

const SCREENSHOTS = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'docs', 'screenshots');

/**
 * Saves docs/screenshots/<name>.png for the README, only when DOC_SCREENSHOTS is set
 * (`npm run screenshots` sets it), so a normal test run leaves the working tree alone.
 */
export async function docShot(page: Page, name: string): Promise<void> {
  if (!process.env.DOC_SCREENSHOTS) return;
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`) });
}

/** Scrolls the memory list so the row of addr is rendered, using the row height the panel publishes. */
export async function scrollToAddr(page: Page, addr: number): Promise<void> {
  await page.getByTestId('memory-list').evaluate((el, a) => {
    const rowHeight = Number((el as HTMLElement).dataset.rowHeight);
    el.scrollTop = Math.max(0, a * rowHeight - el.clientHeight / 2);
  }, addr);
}

/** Types a program in Editor 2, converts it and sends it to memory, then closes the editor. */
export async function loadProgram(page: Page, text: string): Promise<void> {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await page.getByTestId('tab-editor2').click();
  await page.getByTestId('editor2-text').fill(text);
  await page.getByTestId('btn-convertir-a-editor1').click();
  await answerIf(page, 'Hay un Programa en el Editor 1', 'Sí', page.getByTestId('editor1-table'));
  await page.getByTestId('btn-enviar-a-memoria').click();
  await answerIf(page, 'Ya existe un Programa en Memoria Principal', 'Sí', page.getByTestId('msgbox-message'));
  await expect(page.getByTestId('msgbox-message')).toHaveText('Se Recibió el Programa del Editor Interno CON EXITO.');
  await page.getByTestId('msgbox-btn-Aceptar').click();
  await page.getByTestId('win-editor').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('win-editor')).toBeHidden();
}

/**
 * Answers a message box when it asks the given question. It first waits until either a message box
 * or `settled` (what the page shows when no question is asked) is visible, so it never checks
 * before the click has rendered.
 */
export async function answerIf(page: Page, text: string, button: string, settled: Locator): Promise<void> {
  const box = page.getByTestId('msgbox-message');
  await expect(box.or(settled).first()).toBeVisible();
  if ((await box.isVisible()) && (await box.textContent())?.includes(text)) {
    await page.getByTestId(`msgbox-btn-${button}`).click();
  }
}

/** Lines of the monitor of "Dispositivos de E/S". */
export async function monitorLines(page: Page): Promise<string[]> {
  return page.getByTestId('monitor').locator('div').allTextContents();
}

/** Waits for the keyboard prompt, types the value and presses Entrar. */
export async function enterValue(page: Page, prompt: string, value: string): Promise<void> {
  await expect(page.getByTestId('input-prompt')).toHaveText(prompt);
  await page.getByTestId('input-teclado').fill(value);
  await page.getByTestId('btn-entrar-dato').click();
}

export async function closeDialog(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId(testId)).toBeHidden();
}
