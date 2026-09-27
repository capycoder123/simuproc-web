import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { loadProgram } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SimuProc/);
});

test('Guardar Como: la extensión escrita elige el formato y un nombre sin extensión recibe la del formato', async ({ page }) => {
  await loadProgram(page, 'INC AX\nHLT');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-guardar-como').click();
  await page.getByTestId('saveas-name').fill('prog.asm');
  await expect(page.getByRole('radio', { name: /Texto del Editor 2/ })).toBeChecked();
  const asm = page.waitForEvent('download');
  await page.getByTestId('saveas-submit').click();
  const a = await asm;
  expect(a.suggestedFilename()).toBe('prog.asm');
  expect(fs.readFileSync(await a.path(), 'latin1').startsWith('#SimuProc')).toBe(true);

  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-guardar-como').click();
  await page.getByRole('radio', { name: /Programa del Simulador/ }).check();
  await page.getByTestId('saveas-name').fill('prueba');
  const smp = page.waitForEvent('download');
  await page.getByTestId('saveas-submit').click();
  expect((await smp).suggestedFilename()).toBe('prueba.smp');
  await expect(page.getByTestId('status-file')).toHaveText('prueba.smp');
});

test('Aceptar en Configurar no deshace el botón Cod', async ({ page }) => {
  await page.getByTestId('btn-cod').click();
  await expect(page.getByTestId('btn-cod')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('menu-opciones').click();
  await page.getByTestId('menu-configurar').click();
  await page.getByTestId('config-lines').fill('500');
  await page.getByTestId('config-accept').click();
  await expect(page.getByTestId('btn-cod')).toHaveAttribute('aria-pressed', 'true');
});

test('Modo oscuro: cambiar una opción no fija los colores claros de lectura y escritura', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await page.getByTestId('menu-opciones').click();
  await page.getByTestId('menu-configurar').click();
  await page.getByTestId('config-accept').click();
  const read = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--read').trim());
  expect(read).toBe('#6d5a12');
});

test('Cerrar la pestaña con un programa modificado pide confirmación', async ({ page }) => {
  await loadProgram(page, 'INC AX\nHLT');
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe('beforeunload');
  await d.accept();
});
