import { expect, test } from '@playwright/test';
import { closeDialog, docShot, enterValue, loadProgram } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SimuProc/);
});

test('Entrada de Instrucciones Manualmente: MSG y HLT, luego ejecutar', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-manual').click();
  await expect(page.getByTestId('win-manual')).toBeVisible();
  await page.getByTestId('manual-list').selectOption('42');
  await expect(page.getByTestId('manual-description')).toHaveText('Escribe en Pantalla un comentario');
  await page.getByTestId('manual-comment').fill('hola desde la entrada manual');
  await page.getByTestId('manual-ok').click();
  await expect(page.getByTestId('status')).toHaveText('Se añadió la instrucción: MSG');
  await page.getByTestId('manual-list').selectOption('1');
  await page.getByTestId('manual-operands').fill('ZZZ');
  await page.getByTestId('manual-ok').click();
  await expect(page.getByTestId('manual-error')).toHaveText('Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF');
  await page.getByTestId('manual-list').selectOption('99');
  await page.getByTestId('manual-ok').click();
  await expect(page.getByTestId('manual-addr')).toHaveValue('002');
  await closeDialog(page, 'win-manual');
  await expect(page.getByTestId('mem-000')).toContainText('MSG');
  await expect(page.getByTestId('mem-001')).toContainText('HLT');
  await page.getByTestId('btn-mostrar-es').click();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('monitor')).toContainText('hola desde la entrada manual');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
});

test('Estadísticas muestra los contadores del programa ejecutado', async ({ page }) => {
  await loadProgram(page, 'INC AX\nINC AX\nJMP 4\nNOP\nCMP 10\nHLT');
  await page.getByTestId('speed').fill('10');
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await page.getByTestId('menu-simulacion').click();
  await page.getByTestId('menu-estadisticas').click();
  await expect(page.getByTestId('win-stats')).toBeVisible();
  await expect(page.getByTestId('stats-header')).toContainText('ha terminado su ejecución con éxito');
  await expect(page.getByTestId('stats-instr')).toHaveText('5');
  await docShot(page, 'estadisticas');
});

test('Vigilante de Memoria pausa cuando cambia la posición vigilada', async ({ page }) => {
  await loadProgram(page, 'LDT dato\nSTA 20\nINC AX\nSTA 20\nHLT');
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-vigilante').click();
  await expect(page.getByTestId('win-watch')).toBeVisible();
  await page.getByTestId('watch-1-addr').fill('20');
  await page.getByTestId('watch-1').getByLabel('Ver/Activar').check();
  await page.getByTestId('watch-1').getByLabel('Pausar Simulación').check();
  await closeDialog(page, 'win-watch');
  await page.getByTestId('speed').fill('10');
  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'dato', '5');
  await expect(page.getByTestId('msgbox-message')).toContainText('El contenido de la dirección 020, ha cambiado de 0000000000000000 a 0000000000000101');
  await expect(page.getByTestId('win-watch')).toBeVisible();
  await docShot(page, 'vigilante');
  await page.getByTestId('msgbox-btn-No').click();
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await expect(page.getByTestId('watch-1-value')).toHaveText('0000000000000110');
  await expect(page.getByTestId('watch-1-history')).toContainText('0000000000000101');
});

test('Switches - Puerto 9 se leen con IN registro,9', async ({ page }) => {
  await loadProgram(page, 'IN AX,9\nEAP switches\nHLT');
  await page.getByTestId('menu-dispositivos').click();
  await page.getByTestId('menu-switches').click();
  await expect(page.getByTestId('win-switches')).toBeVisible();
  await page.getByTestId('switch-0').click();
  await page.getByTestId('switch-2').click();
  await page.getByTestId('switch-F').click();
  await expect(page.getByTestId('switches-value')).toHaveText('1000000000000101');
  await docShot(page, 'switches');
  await closeDialog(page, 'win-switches');
  await page.getByTestId('btn-mostrar-es').click();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('monitor')).toContainText('switches 32773');
});

test('Configurar SimuProc: ignorar instrucciones no reconocidas', async ({ page }) => {
  await loadProgram(page, 'MSG antes\n1111\nMSG despues\nHLT');
  await page.getByTestId('btn-mostrar-es').click();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('msgbox-message')).toContainText('El Error esta en la Posición de memoria: 001');
  await page.getByTestId('msgbox-btn-No').click();
  await expect(page.getByTestId('status')).toContainText('Simulación Detenida.');
  await page.getByTestId('menu-opciones').click();
  await page.getByTestId('menu-configurar').click();
  await expect(page.getByTestId('dlg-config')).toBeVisible();
  await page.getByTestId('config-ignore').check();
  await docShot(page, 'configurar');
  await page.getByTestId('config-accept').click();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('monitor')).toContainText('despues');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await expect(page.getByTestId('log')).toContainText('Codigo de Operacion no reconocido en la Dir: 001 (instrucción ignorada)');
});

test('Modo oscuro sigue la preferencia del sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(27, 29, 34)');
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await page.getByTestId('btn-ejemplos').click();
  await page.getByTestId('ejemplo-simuproc-Ejemplo6.asm').click();
  await docShot(page, 'oscuro');
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe('rgb(223, 225, 230)');
});

test('Conversión de bases convierte entre bases y desglosa IEEE 754', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-conversion').click();
  await page.getByTestId('bases-decimal').fill('255');
  await expect(page.getByTestId('bases-binario')).toHaveValue('11111111');
  await expect(page.getByTestId('bases-hex')).toHaveValue('FF');
  await expect(page.getByTestId('bases-octal')).toHaveValue('377');
  await page.getByTestId('bases-hex').fill('1F1');
  await expect(page.getByTestId('bases-decimal')).toHaveValue('497');
  await page.getByTestId('bases-binario').fill('102');
  await expect(page.getByTestId('bases-error')).toHaveText('Número Binario No Válido, entre solo 1 y 0s.');
  await page.getByTestId('bases-float-dec').fill('100.25');
  await expect(page.getByTestId('bases-float-bin')).toHaveValue('01000010110010001000000000000000');
  await expect(page.getByTestId('bases-float-exp')).toHaveValue('10000101');
  await docShot(page, 'conversion');
});
