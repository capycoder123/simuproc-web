# Material de referencia de SimuProc 1.4.3.0

Recopilado el 2026-09-26 desde el instalador original (`SimuProc14-Setup.exe`, Inno Setup, extraído con
`innoextract`). Es la fuente de verdad para la reimplementación. Todo este material es de Vladimir Yepes
Bedoya y no está cubierto por la licencia MIT del proyecto: ver [`NOTICE.md`](../NOTICE.md).

## original/  (del instalador oficial, freeware "puede ser distribuido libremente")
- `smpr_esp.lng` / `smpr_eng.lng`: todos los textos de la interfaz original (menús, ventana principal,
  lista de instrucciones con su descripción corta, mensajes de error del ingreso manual, barra de estado).
- `novedades.txt`: changelog 0.9.9 → 1.4.3.0. Documenta cambios de semántica (CMP ya no modifica AX,
  INC detecta overflow, lógicas/desplazamientos actualizan Z, JMA/JME no limpian N tras CMP, etc.).
- `leame.txt`: readme y autoría (Vladimir Yepes Bedoya, "Vlaye").
- `ayuda-chm/`: las dos páginas de la ayuda (`instrucc.html` = instrucciones; `comofunc.html` = ciclo fetch/ejecución).
- `captions-formularios.txt`: captions, hints y listas de cada ventana (DFM) del binario: ventana principal,
  Dispositivos de E/S (radio Decimal/Binario, Entrar Dato, Último Dato), Editor 1/2 y sus barras, Configurar,
  Conversor de bases, Estadísticas, Vigilante, Switches puerto 9, Modificar memoria, Acerca de.
- `strings-ui-y-ejecucion.txt`: strings extraídos del binario `Procesador.exe` (desempaquetado con UPX).
  Contiene: textos de la animación
  paso a paso de cada instrucción, mensajes de error en ejecución (división por cero, LDB/STB fuera de
  memoria, puerto inválido, MOV a BP) y ayuda de puertos (1, 8, 9, 13). Faltan las líneas de 3 caracteres o
  menos (el volcado usó `strings -n 4`).

## Programas de ejemplo (en `src/ejemplos/`)

Los programas se guardan una sola vez, en `src/ejemplos/`, que es lo que la app empaqueta:
- `simuproc/Ejemplo1.asm`–`Ejemplo6.asm`: los 6 programas de ejemplo incrustados en el Editor 2 del original,
  recuperados del binario con todas sus líneas (incluidas las cortas como `#D`, `#19`, `HLT`). Ejemplos 5 y 6 usan
  punto flotante (IN/OUT puerto 1, LDF/STF, ADDF/SUBF/MULF/DIVF; `SUBF` + `JEQ` como comparación).
- `smp/`: los dos únicos programas `.smp` oficiales. Definen el formato de archivo `.smp`.
- `curso/`: 17 programas del profesor del ramo *Arquitectura de Computadores* (UCN) en formato texto (Editor 2).
  Cabecera `#SimuProc 1.4.x.0`, instrucciones en mayúscula o minúscula, direcciones hex con o sin sufijo `H`,
  mensajes con o sin comillas, directiva `#dir` para fijar la dirección de las líneas siguientes, datos en binario.

## Material del ramo (no incluido en el repositorio)

El ramo usa dos documentos que no se distribuyen aquí; `docs/fidelidad.md` los cita por su título:
- *Instrucciones Soportadas en SimuProc 1.4.3*: especificación de las instrucciones usada por el ramo.
- *Quickref - SimuProc* (versión del 1 de junio de 2016): guía de referencia rápida. OJO: contiene dos erratas
  respecto al original: escribe `XBA` (el original es `XAB`, código 03) y `91 HLT` (el original es `99 HLT`);
  omite `39 JNE`.
