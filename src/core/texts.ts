/** Runtime texts of the original SimuProc 1.4.3.0 (strings-ui-y-ejecucion.txt, smpr_esp.lng). */
export const STATUS = {
  detenida: 'Simulación Detenida.',
  simulando: 'Simulando . . .',
  error: 'Error ....',
  sinPrograma: 'No Hay ningún Programa en Memoria',
  errorAbrir: 'Error al Intentar Abrir: ',
  abierto: 'Se ha Abierto el Archivo: ',
  guardado: 'Se Guardo Su Programa con Exito en: ',
  cargado: '(Programa Cargado en Memoria)',
  memoriaLlena: 'SE LLENO LA MEMORIA',
  sinAnimacion: 'El Programa se esta Ejecutando sin Animación',
  vigilantePausa: 'Vigilante de Memoria (Simulación en Pausa)',
} as const;

export const END_TEXTS = {
  terminado: 'El Programa ha Terminado.',
  completa: 'Simulación Completa.',
  manual: 'El Programa ha sido Terminado manualmente.',
  incompleta: 'Simulación Incompleta.',
} as const;

export const FETCH_TEXTS = {
  pc: (pc: string) => `Leo en PC la proxima direccion a ejecutar: ${pc}`,
  mar: 'Envio al MAR la proxima direccion de mem a leer.',
  mdr: 'Llevo al MDR el contenido de dicha dirección de memoria.',
  ir: 'Le entrego al IR el dato para que lo decodifique e incremento el PC.',
} as const;

/** "1 Error Encontrado" / "n Errores Encontrados": the count of the Editor error dialogs. */
const erroresEncontrados = (n: number) => `${n} ${n === 1 ? 'Error Encontrado' : 'Errores Encontrados'}`;

export const DIALOG_TEXTS = {
  nuevoTitulo: 'Nuevo Programa?',
  nuevo: 'Desea Borrar el Contenido de la Memoria?',
  reiniciarTitulo: 'Reiniciar Programa?',
  reiniciar: 'Desea Poner los Registros en Cero y suspender la ejecución?',
  sinProgramaTitulo: 'Atención',
  sinPrograma:
    'No hay ningun Programa en la Memoria!!\n\nIntroduzca uno:\n-instrucción por instrucción.\n-Escriba uno Usando el Editor\n-o Abra uno desde un archivo.',
  cambiadoTitulo: 'Mensaje de SimuProc',
  cambiado: 'El Programa en Memoria ha Cambiado\n\nDesea Guardarlo??',
  detenerParaAbrir: 'Detener Simulación para abrir otro programa?',
  archivoNoValido: 'NO es un archivo Válido Para Abrir en este Simulador.',
  archivoMalo: 'El archivo Parece estar Malo,\nSe detecto un final no esperado.',
  nadaQueGrabar: 'No hay ningun Programa en Memoria Para Grabar.',
  noAbrir: 'No se pudo abrir el archivo.',
  editorRecibido: 'Se Recibió el Programa del Editor Interno CON EXITO.',
  erroresEncontrados,
  editorErrores: (n: number) => `${erroresEncontrados(n)}!! Desea ver los Errores?`,
  sobrescribirMemoria: 'Ya existe un Programa en Memoria Principal\nSobrescribir con este?',
  sobrescribirEditor1DesdeMemoria: 'Hay un Programa en el Editor 1\nSobrescribir con el de La Memoria de SimuProc?',
  sobrescribirEditor1DesdeEditor2: 'Hay un Programa en el Editor 1\nSobrescribir con el del Editor 2',
  sobrescribirEditor2: 'Hay un Programa en el Editor 2\nSobrescribir con este?',
  sobrescribirEditor2DesdeEditor1: 'Hay un Programa en el Editor 2\nSobrescribir con el del Editor 1?',
  limpiarEditor1: 'Limpiar Editor 1 ?',
  limpiarEditor2: 'Limpiar Editor 2 ?',
  advertencia: 'Advertencia',
  entradaNoPedida: 'No toque este Botón hasta que se le pida que entre un Dato.',
  ultimoDatoLeido: (v: string) => `Último Dato (${v}) se ha Leido Correctamente.`,
  entreDato: 'ENTRE UN DATO en la ventana de Dispositivos de E/S para continuar la Simulación',
  entreFlotante: 'ENTRE un numero entero o flotante, positivo o negativo, para continuar la Simulación',
} as const;

export const PORT_HELP = {
  1: 'Usar LDT y EAP para pedir y mostrar operaciones con enteros.\nestas pueden mostrar un mensaje si se desea.\nUsar IN AX,1  y  OUT 1,AX  para pedir y mostrar numeros de punto flotante,\n enteros desde -2GB hasta 2GB.\nPara mostrar mensajes, usar MSG',
  8: 'Este puerto Retorna al registro especificado los segundos del sistema.\n(Sirve para generar números aleatorios)\nEjemplo:\n IN BX,8 ;Lleva a BX un numero entre 0 y 59',
  13: 'PC Speaker:\nGenera sonidos a través del Altavoz de tu PC.\nPara generar un Sonido necesitas dar la frecuencia y la duración en milisegundos\nLa frecuencia debe ser entre 7Hz y 32767Hz\nLa frecuencia es leida del registro especificado en la instrucción, y la\nduración es leida del registro BX\nEjemplo: Supongamos que AX = 101000101000 y BX = 111110100\nOUT 13,AX ; produce un sonido de 2600Hz durante 500 ms\nPara averiguar los Hz de algunas notas se puede usar la sgte formula:\nFrecuencia, en Hertz = 440 * 2^[(octavo-4) + (nota/12)]\nDonde las notas comienzan así:\nA=0 A#=1 B=2 C=3 C#=4 D=5 D#=6 E=7 F=8 F#=9 G=10 G#=11\nsiendo:\nC=Do D=Re E=Mi F=Fa G=Sol A=La B=Si\nPor ejemplo: C6 => 440 * 2^[(6-4) + 3/12)] = 2093 Hz, \n casi 2.1 kHz',
} as const;
