import { expect, test, type Page } from '@playwright/test';
import { closeDialog, docShot, enterValue } from './helpers';

function rowSources(page: Page) {
  return page.getByTestId('editor1-table').locator('input[aria-label="Instrucción"]');
}

async function openEditorExamples(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveTitle(/SimuProc/);
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await expect(page.getByTestId('win-editor')).toBeVisible();
  await page.getByTestId('btn-ejemplos').click();
}

test('Ejemplos del curso › Ejemplo2.asm: convertir, enviar a memoria, ejecutar con 5 y 7', async ({ page }) => {
  await openEditorExamples(page);
  await page.getByTestId('ejemplo-curso-Ejemplo2.asm').click();
  await expect(page.getByTestId('editor2-text')).toHaveValue(/msg suma de dos datos/);
  await docShot(page, 'editor');

  await page.getByTestId('btn-convertir-a-editor1').click();
  await expect(rowSources(page)).toHaveCount(7);
  await expect(rowSources(page).nth(4)).toHaveValue('ADD F0');
  await page.getByTestId('btn-enviar-a-memoria').click();
  await expect(page.getByTestId('msgbox-message')).toHaveText('Se Recibió el Programa del Editor Interno CON EXITO.');
  await page.getByTestId('msgbox-btn-Aceptar').click();
  await closeDialog(page, 'win-editor');
  await expect(page.getByTestId('mem-000')).toContainText('MSG');

  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'ingresa un dato', '5');
  await enterValue(page, 'ingresa otro dato', '7');
  await expect(page.getByTestId('monitor')).toContainText('resultado 12');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await expect(page.getByTestId('reg-AX')).toContainText('0000000000001100');
  await docShot(page, 'dispositivos-es');
});

test('Programas .smp › Calcula Paridad de un Numero.smp: ejecutar con 7', async ({ page }) => {
  await openEditorExamples(page);
  await page.getByTestId('ejemplo-smp-Calcula Paridad de un Numero.smp').click();
  await expect(rowSources(page).nth(4)).toHaveValue('ROL AX,1');
  await closeDialog(page, 'win-editor');
  await expect(page.getByTestId('status-file')).toContainText('Calcula Paridad de un Numero.smp');

  await page.getByTestId('speed').fill('10');
  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'A que numero desea hallarle la Paridad?', '7');
  await expect(page.getByTestId('monitor')).toContainText('La Paridad de Dicho numero es: 3');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await expect(page.getByTestId('reg-AX')).toContainText('0000000000000011');
  await page.getByTestId('btn-ocultar-es').click();
  await docShot(page, 'principal');
});
