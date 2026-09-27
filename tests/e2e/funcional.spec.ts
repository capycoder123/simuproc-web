import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { closeDialog, enterValue, loadProgram, monitorLines, scrollToAddr } from './helpers';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SimuProc/);
});

test('Paso a paso ejecuta un ciclo por pulsación y termina con HLT', async ({ page }) => {
  await loadProgram(page, 'INC AX\nINC AX\nHLT');
  await page.getByTestId('btn-paso').click();
  await expect(page.getByTestId('reg-AX')).toContainText('0000000000000001');
  await expect(page.getByTestId('status')).toHaveText('Simulación en Pausa.');
  await expect(page.getByTestId('btn-reanudar')).toBeVisible();
  await page.getByTestId('btn-paso').click();
  await expect(page.getByTestId('reg-AX')).toContainText('0000000000000010');
  await page.getByTestId('btn-paso').click();
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await expect(page.getByTestId('reg-PC')).toHaveText('003');
});

test('Pausar y Reanudar un bucle infinito sin animación, luego Reiniciar Registros', async ({ page }) => {
  await loadProgram(page, 'INC BX\nJMP 0');
  await page.getByTestId('animation').uncheck();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('status')).toHaveText('El Programa se esta Ejecutando sin Animación');
  await page.getByTestId('btn-pausar').click();
  await expect(page.getByTestId('status')).toHaveText('Simulación en Pausa.');
  const bx = await page.getByTestId('reg-BX').textContent();
  await page.getByTestId('btn-reanudar').click();
  await expect(page.getByTestId('status')).toHaveText('El Programa se esta Ejecutando sin Animación');
  await page.getByTestId('btn-pausar').click();
  await expect(page.getByTestId('status')).toHaveText('Simulación en Pausa.');
  expect(await page.getByTestId('reg-BX').textContent()).not.toBe(bx);
  await page.getByTestId('btn-reiniciar').click();
  await expect(page.getByTestId('msgbox-message')).toHaveText('Desea Poner los Registros en Cero y suspender la ejecución?');
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(page.getByTestId('status')).toContainText('Terminado manualmente');
  await expect(page.getByTestId('reg-PC')).toHaveText('000');
  await expect(page.getByTestId('reg-BX')).toContainText('0000000000000000');
  await expect(page.getByTestId('btn-ejecutar')).toBeEnabled();
});

test('Nuevo Programa borra la memoria tras confirmar; los flags se fuerzan con doble clic', async ({ page }) => {
  await loadProgram(page, 'MSG hola\nHLT');
  await expect(page.getByTestId('mem-000')).toContainText('MSG');
  await page.getByTestId('flag-Z').dblclick();
  await expect(page.getByTestId('flag-Z')).toHaveText('1');
  await page.getByTestId('flag-Z').dblclick();
  await expect(page.getByTestId('flag-Z')).toHaveText('0');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-nuevo').click();
  await expect(page.getByTestId('msgbox-message')).toHaveText('Desea Borrar el Contenido de la Memoria?');
  await page.getByTestId('msgbox-btn-No').click();
  await expect(page.getByTestId('mem-000')).toContainText('MSG');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-nuevo').click();
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(page.getByTestId('mem-000')).toHaveText(/0000000000000000/);
  await expect(page.getByTestId('status')).toHaveText('No Hay ningún Programa en Memoria');
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('msgbox-message')).toContainText('No hay ningun Programa en la Memoria!!');
  await page.getByTestId('msgbox-btn-Aceptar').click();
});

test('Modificar una Posición de Memoria: por menú y por doble clic', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-modificar').click();
  await page.getByTestId('modify-addr').fill('ZZZ');
  await page.getByTestId('modify-value').fill('1');
  await page.getByTestId('modify-submit').click();
  await expect(page.getByTestId('modify-msg')).toHaveText('Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF');
  await page.getByTestId('modify-addr').fill('10');
  await page.getByTestId('modify-value').fill('mov ax , bx');
  await page.getByTestId('modify-submit').click();
  await expect(page.getByTestId('modify-msg')).toHaveText('Cambio Exitoso.');
  await closeDialog(page, 'dlg-modify');
  await expect(page.getByTestId('mem-010')).toContainText('MOV AX,BX');
  await page.getByTestId('btn-cod').click();
  await expect(page.getByTestId('mem-010')).toContainText('10AX,BX');
  await page.getByTestId('btn-cod').click();
  await page.getByTestId('mem-020').dblclick();
  await expect(page.getByTestId('modify-addr')).toHaveValue('020');
  await page.getByTestId('modify-value').fill('1011');
  await page.getByTestId('modify-submit').click();
  await closeDialog(page, 'dlg-modify');
  await expect(page.getByTestId('mem-020')).toContainText('0000000000001011');
  await expect(page.getByTestId('status-file')).toContainText('*');
});

test('Ayuda, Acerca de y ayuda de puertos', async ({ page }) => {
  await page.getByTestId('menu-ayuda').click();
  await page.getByTestId('menu-instrucciones').click();
  await expect(page.getByTestId('dlg-help')).toContainText('Terminar Programa');
  await expect(page.getByTestId('dlg-help')).toContainText('LDA [Dirección Mem]');
  await closeDialog(page, 'dlg-help');
  await page.getByTestId('menu-ayuda').click();
  await page.getByTestId('menu-acerca').click();
  await expect(page.getByTestId('dlg-about')).toContainText('Vladimir Yepes Bedoya');
  await expect(page.getByTestId('dlg-about').getByRole('link', { name: 'simuproc.cjb.net' })).toHaveAttribute('href', 'http://simuproc.cjb.net');
  await closeDialog(page, 'dlg-about');
  await page.getByTestId('menu-dispositivos').click();
  await page.getByRole('menuitem', { name: '1 - Teclado y Pantalla (E y S) ...' }).click();
  await expect(page.getByRole('dialog', { name: 'Dispositivos', exact: true })).toContainText('Usar LDT y EAP para pedir y mostrar operaciones con enteros.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Dispositivos', exact: true })).toBeHidden();
  await expect(page.getByTestId('win-devices')).toBeVisible();
  await page.getByTestId('menu-dispositivos').click();
  await page.getByRole('menuitem', { name: '8 - Reloj (E)' }).click();
  await expect(page.getByRole('dialog', { name: 'Dispositivos', exact: true })).toContainText('IN BX,8');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Dispositivos', exact: true })).toBeHidden();
  await page.getByTestId('menu-archivo').click();
  await page.getByRole('menuitem', { name: 'Salir' }).click();
  await expect(page.getByTestId('msgbox-message')).toContainText('cierra esta pestaña');
  await page.getByTestId('msgbox-btn-Aceptar').click();
});

test('Editor: ejemplo incrustado, conversiones en ambos sentidos, limpiar y traer desde memoria', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await page.getByTestId('btn-ejemplos').click();
  await page.getByTestId('ejemplo-simuproc-Ejemplo2.asm').click();
  await expect(page.getByTestId('editor2-text')).toHaveValue(/MOV AX,D/);
  await page.getByTestId('btn-convertir-a-editor1').click();
  const sources = page.getByTestId('editor1-table').locator('input[aria-label="Instrucción"]');
  await expect(sources).toHaveCount(8);
  await expect(sources.nth(1)).toHaveValue('MOV AX,D');
  await expect(page.getByTestId('editor1-table').locator('input[aria-label="Dirección"]').nth(6)).toHaveValue('00D');
  await page.getByTestId('btn-convertir-a-editor2').click();
  await expect(page.getByTestId('msgbox-message')).toContainText('Hay un Programa en el Editor 2');
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(page.getByTestId('editor2-text')).toHaveValue(/#SimuProc 1\.4\.3\.0\nMSG 'Programa Ejemplo 2'\nMOV AX,D ;Llevo/);
  await expect(page.getByTestId('editor2-text')).toHaveValue(/\n#D\n1101 ;Es el numero 13/);
  await page.getByTestId('tab-editor1').click();
  await page.getByTestId('btn-enviar-a-memoria').click();
  await page.getByTestId('msgbox-btn-Aceptar').click();
  await expect(page.getByTestId('mem-00D')).toContainText('0000000000001101');
  await page.getByRole('button', { name: 'Limpiar Editor 1' }).click();
  await expect(page.getByTestId('msgbox-message')).toHaveText('Limpiar Editor 1 ?');
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(sources).toHaveCount(0);
  await page.getByTestId('btn-traer-memoria').click();
  await expect(sources).toHaveCount(8);
  await expect(sources.nth(0)).toHaveValue('MSG');
  await expect(page.getByTestId('editor1-table').locator('input[aria-label="Comentario"]').nth(0)).toHaveValue('Programa Ejemplo 2');
  await page.getByTestId('tab-editor2').click();
  await page.getByTestId('editor2-text').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'LDA', exact: true }).click();
  await expect(page.getByTestId('editor2-text')).toHaveValue(/LDA /);
});

test('Teclado: entradas inválidas, modo Binario, Último Dato y botón sin petición', async ({ page }) => {
  await page.getByTestId('btn-mostrar-es').click();
  await page.getByTestId('btn-entrar-dato').click();
  await expect(page.getByTestId('win-devices')).toContainText('No toque este Botón hasta que se le pida que entre un Dato.');
  await loadProgram(page, 'LDT dato\nEAP v\nHLT');
  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'dato', 'abc');
  await expect(page.getByTestId('input-error')).toHaveText('Numero Decimal No Válido');
  await page.getByTestId('input-teclado').fill('70000');
  await page.getByTestId('btn-entrar-dato').click();
  await expect(page.getByTestId('input-error')).toHaveText('El número esta muy Grande');
  await page.getByTestId('win-devices').getByLabel('Binario').check();
  await page.getByTestId('input-teclado').fill('102');
  await page.getByTestId('btn-entrar-dato').click();
  await expect(page.getByTestId('input-error')).toHaveText('Numero Binario No Válido, entre solo 1 y 0s.');
  await page.getByTestId('input-teclado').fill('101');
  await page.getByTestId('btn-entrar-dato').click();
  await expect(page.getByTestId('monitor')).toContainText('v 5');
  await expect(page.getByTestId('last-decimal')).toHaveText('5');
  await expect(page.getByTestId('last-binary')).toHaveText('0000000000000101');
  await page.getByRole('button', { name: 'Limpiar Monitor' }).click();
  await expect(page.getByTestId('monitor')).not.toContainText('v 5');
  await page.getByTestId('btn-ocultar-es').click();
  await expect(page.getByTestId('win-devices')).toBeHidden();
});

test('IN registro,1 lee reales (con coma o punto) y OUT 1 los imprime', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await page.getByTestId('btn-ejemplos').click();
  await page.getByTestId('ejemplo-simuproc-Ejemplo5.asm').click();
  await page.getByTestId('btn-convertir-a-editor1').click();
  await page.getByTestId('btn-enviar-a-memoria').click();
  await page.getByTestId('msgbox-btn-Aceptar').click();
  await closeDialog(page, 'win-editor');
  await page.getByTestId('speed').fill('10');
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('input-prompt')).toHaveText('Decimal Flotante positivo o negativo');
  await expect(page.getByTestId('win-devices').getByLabel('Decimal')).toBeDisabled();
  await page.getByTestId('input-teclado').fill('2,5');
  await page.getByTestId('btn-entrar-dato').click();
  await enterValue(page, 'Decimal Flotante positivo o negativo', '1.5');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  expect((await monitorLines(page)).slice(-8)).toEqual(['Suma:', '4', 'Resta:', '1', 'Mult:', '3.75', 'Div:', '1.6667']);
});

test('Errores en ejecución: división por cero (fatal), LDB fuera de memoria (pausa) y POP vacío (ignorable)', async ({ page }) => {
  await loadProgram(page, 'DIV 10\nHLT');
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('msgbox-message')).toHaveText('Su Programa Intentó hacer una División por Cero.  Simulación Detenida.');
  await page.getByTestId('msgbox-btn-Aceptar').click();
  await expect(page.getByTestId('status')).toHaveText('Simulación Detenida.');
  await expect(page.getByTestId('alu')).toContainText('Intento de Division por Cero.');

  await loadProgram(page, 'INC BX\nLDB FFF\nMSG sigue\nHLT');
  await page.getByTestId('btn-mostrar-es').click();
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('msgbox-message')).toContainText('Ha superado el final de la memoria.');
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(page.getByTestId('status')).toHaveText('Simulación en Pausa.');
  await page.getByTestId('btn-reanudar').click();
  await expect(page.getByTestId('monitor')).toContainText('sigue');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');

  await loadProgram(page, 'POP AX\nMSG fin\nHLT');
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('msgbox-message')).toContainText('La Instrucción POP no puede ser utilizada');
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(page.getByTestId('monitor')).toContainText('fin');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
});

test('Guardar Como descarga un .smp y Guardar reutiliza el nombre; el editor guarda .asm', async ({ page }) => {
  await loadProgram(page, "MSG 'hola'\nLDT dato\nHLT");
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-guardar-como').click();
  await page.getByTestId('saveas-name').fill('prueba.smp');
  const download = page.waitForEvent('download');
  await page.getByTestId('saveas-submit').click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('prueba.smp');
  const content = fs.readFileSync(await d.path(), 'latin1');
  expect(content.split('\n').slice(0, 8)).toEqual(['SimuProc 1.4 - Vlaye', '1ba', 'd', '', '', '', '42000', 'hola']);
  await expect(page.getByTestId('status')).toHaveText('Se Guardo Su Programa con Exito en: prueba.smp');
  await expect(page.getByTestId('status-file')).toHaveText('prueba.smp');
  const again = page.waitForEvent('download');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-guardar').click();
  expect((await again).suggestedFilename()).toBe('prueba.smp');

  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-editor').click();
  await page.getByTestId('tab-editor2').click();
  const asm = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar Programa en un Archivo' }).click();
  const a = await asm;
  expect(a.suggestedFilename()).toBe('prueba.asm');
  const asmText = fs.readFileSync(await a.path(), 'latin1');
  expect(asmText.startsWith('#SimuProc 1.4.3.0\r\n')).toBe(true);
  expect(asmText).toContain("MSG 'hola'\r\n");
});

test('Abrir Programa carga .asm y .smp desde el disco', async ({ page }) => {
  const asmBytes = fs.readFileSync(path.join(ROOT, 'src/ejemplos/curso/multiplica.asm'));
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-abrir').click();
  await (await chooser).setFiles({ name: 'multiplica.asm', mimeType: 'text/plain', buffer: asmBytes });
  await expect(page.getByTestId('status')).toHaveText('Se ha Abierto el Archivo: multiplica.asm');
  await expect(page.getByTestId('mem-005')).toContainText('MUL 10');
  await expect(page.getByTestId('mem-001')).toHaveAttribute('title', /ingresa un número/);

  const smpBytes = fs.readFileSync(path.join(ROOT, 'src/ejemplos/smp/Calcula Numeros Primos.smp'));
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-abrir').click();
  await (await chooser2).setFiles({ name: 'primos.smp', mimeType: 'application/octet-stream', buffer: smpBytes });
  await expect(page.getByTestId('status')).toHaveText('Se ha Abierto el Archivo: primos.smp');
  await expect(page.getByTestId('mem-001')).toContainText('MOV 35,03D');
  await page.getByTestId('speed').fill('10');
  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'Hasta que numero desea hallar Numeros Primos?', '20');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  expect(await monitorLines(page)).toEqual(['Numeros Primos 1', 'Numeros Primos 2', 'Numeros Primos 3', '5', '7', '11', '13', '17', '19']);
});

test('Abrir un .asm con un dato de 24 dígitos lo reporta; corregido en el Editor 2, el programa corre', async ({ page }) => {
  const source = ['#SimuProc 1.4.3.0', 'MSG producto', 'LDA 200', 'MUL 201', 'STF 300', 'EAP parte baja =', 'MOV AX,BX', 'EAP parte alta =', 'HLT', '#200', '101010101010101010101010', '1100'];
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('menu-archivo').click();
  await page.getByTestId('menu-abrir').click();
  await (await chooser).setFiles({ name: 'producto.asm', mimeType: 'text/plain', buffer: Buffer.from(source.join('\r\n') + '\r\n') });
  await expect(page.getByTestId('msgbox-message')).toHaveText('1 Error Encontrado!! Desea ver los Errores?');
  await page.getByTestId('msgbox-btn-Sí').click();
  await expect(page.getByTestId('error-list')).toContainText('INSTRUCCION NO VALIDA en la Dir: 200');
  await closeDialog(page, 'dlg-errors');
  await expect(page.getByTestId('editor-messages')).toContainText('dato binario de 24 dígitos');
  const text = await page.getByTestId('editor2-text').inputValue();
  await page.getByTestId('editor2-text').fill(text.replace('101010101010101010101010', '1011101110111'));
  await page.getByTestId('btn-convertir-a-editor1').click();
  await page.getByTestId('btn-enviar-a-memoria').click();
  await expect(page.getByTestId('msgbox-message')).toHaveText('Se Recibió el Programa del Editor Interno CON EXITO.');
  await page.getByTestId('msgbox-btn-Aceptar').click();
  await closeDialog(page, 'win-editor');
  await page.getByTestId('btn-mostrar-es').click();
  await page.getByTestId('speed').fill('10');
  await page.getByTestId('btn-ejecutar').click();
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  // 6007 x 12 = 72084 = 1 x 65536 + 6548: STF leaves BX (high part) in 300 and AX (low part) in 301.
  expect(await monitorLines(page)).toEqual(['producto', 'parte baja = 6548', 'parte alta = 1']);
  await scrollToAddr(page, 0x300);
  await expect(page.getByTestId('mem-300')).toHaveAttribute('title', /= 1 decimal/);
  await expect(page.getByTestId('mem-301')).toHaveAttribute('title', /= 6548 decimal/);
});

test('Vigilante pausa al igualar un valor y Cancelar termina; Estadísticas se abren solas al terminar', async ({ page }) => {
  await loadProgram(page, 'LDT dato\nSTA 20\nHLT');
  await page.getByTestId('menu-simulacion').click();
  await page.getByTestId('menu-estadisticas').click();
  await page.getByTestId('win-stats').getByLabel('Mostrar después de la ejecución').check();
  await closeDialog(page, 'win-stats');
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-vigilante').click();
  await page.getByTestId('watch-1-addr').fill('20');
  await page.getByTestId('watch-1').getByLabel('Ver/Activar').check();
  await page.getByTestId('watch-1').getByLabel('Pausar solo si el Valor es =').check();
  await page.getByTestId('watch-1-compare').fill('5');
  await closeDialog(page, 'win-watch');
  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'dato', '5');
  await expect(page.getByTestId('msgbox-message')).toContainText('es IGUAL al valor 5 especificado por ud en la Posición de Vigilancia "1"');
  await page.getByTestId('msgbox-btn-Cancelar').click();
  await expect(page.getByTestId('status')).toContainText('Terminado manualmente');
  await expect(page.getByTestId('win-stats')).toBeHidden();
  await page.getByTestId('btn-ejecutar').click();
  await enterValue(page, 'dato', '6');
  await expect(page.getByTestId('status')).toContainText('Simulación Completa.');
  await expect(page.getByTestId('win-stats')).toBeVisible();
  await expect(page.getByTestId('stats-instr')).toHaveText('3');
});

test('Entrada manual: Borrar retrocede y avisa cuando no hay nada', async ({ page }) => {
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-manual').click();
  await page.getByTestId('manual-list').selectOption('4');
  await page.getByTestId('manual-ok').click();
  await page.getByTestId('manual-list').selectOption('99');
  await page.getByTestId('manual-ok').click();
  await expect(page.getByTestId('mem-001')).toContainText('HLT');
  await page.getByTestId('manual-borrar').click();
  await expect(page.getByTestId('status')).toHaveText('Se Borró la Ultima Instrucción');
  await expect(page.getByTestId('manual-addr')).toHaveValue('001');
  await expect(page.getByTestId('mem-001')).toHaveText(/0000000000000000/);
  await page.getByTestId('manual-borrar').click();
  await page.getByTestId('manual-borrar').click();
  await expect(page.getByTestId('manual-error')).toHaveText('No hay nada que Borrar!!');
  await page.getByTestId('manual-addr').fill('3f');
  await page.getByTestId('manual-list').selectOption('90');
  await page.getByTestId('manual-ok').click();
  await expect(page.getByTestId('status')).toHaveText('Se añadió la instrucción: NOP');
  await scrollToAddr(page, 0x3f);
  await expect(page.getByTestId('mem-03F')).toContainText('NOP');
});

test('Conversión de bases lee un real desde la memoria', async ({ page }) => {
  await loadProgram(page, 'HLT\n#2A\n0100001011001000\n1000000000000000');
  await page.getByTestId('menu-utilidades').click();
  await page.getByTestId('menu-conversion').click();
  await page.getByTestId('bases-mem-addr').fill('2A');
  await page.getByTestId('bases-mem-read').click();
  await expect(page.getByTestId('bases-float-dec')).toHaveValue('100.25');
  await expect(page.getByTestId('bases-float-bin')).toHaveValue('01000010110010001000000000000000');
  await page.getByTestId('bases-base').fill('36');
  await page.getByTestId('bases-otra').fill('zz');
  await expect(page.getByTestId('bases-decimal')).toHaveValue('1295');
  await expect(page.getByTestId('bases-hex')).toHaveValue('50F');
});
