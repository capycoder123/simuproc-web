# Fidelidad con SimuProc 1.4.3.0

SimuProc Web es una reimplementación limpia hecha a partir de la documentación, los textos de la interfaz, los mensajes del binario y los programas de ejemplo del original (carpetas `reference/` y `src/ejemplos/`). El código fuente del original no está disponible, así que varios detalles no documentados se decidieron por evidencia indirecta. Este archivo lista cada decisión, su evidencia y un programa corto para confirmarla en el SimuProc original (Windows, o Linux con `wine`).

Convenciones: los programas están en formato del Editor 2 (texto); las entradas son decimales por el teclado salvo que se indique "puerto 1". "Esperado" es lo que hace SimuProc Web. Si el original difiere, abre un issue o corrige `src/core/cpu.ts` y el test correspondiente en `tests/`.

## 1. Dividendo de DIV: solo AX

- **Decisión**: `DIV mem` divide AX (16 bits) entre `[mem]`; BX recibe el residuo. BX **no** forma parte del dividendo aunque la lista de instrucciones del original diga "AX = BX,AX / …". N siempre queda en 0 (cociente sin signo), como en MUL (sección 4).
- **Evidencia**: `Calcula Numeros Primos.smp` ejecuta `DIV 38` en 01E con un residuo viejo en BX (dejado por `DIV 3A` en 00E) y solo imprime los primos correctos (1, 2, 3, 5, 7, 11, 13, 17, 19 hasta 20) con dividendo de 16 bits. Con dividendo BX:AX el programa oficial imprimiría basura.
- **Confirmar**: cargar `Calcula Numeros Primos.smp`, entrar 20. Esperado: `Numeros Primos 1`, `2`, `3`, `5`, `7`, `11`, `13`, `17`, `19`.

## 2. ADD activa C y O a la vez

- **Decisión**: si AX + [mem] > FFFF, AX queda con los 16 bits bajos, BX con los altos, y C=1 y O=1. Si no, C=0 y O=0. N siempre queda en 0. Z=1 solo si la suma completa es 0 (FFFF+1 → BX:AX = 1:0000 con Z=0), igual que MUL (sección 4).
- **Evidencia**: la especificación solo menciona el Overflow flag, pero `ejemplo6.asm` y `ejemplo2026_3.txt` del profesor bifurcan con `jc` y luego `jo` justo después del ADD y esperan `hay carry` con 40000+30000. Para Z, la especificación del curso (*Instrucciones Soportadas en SimuProc 1.4.3*, no incluida en el repositorio) define Zero sobre "el resultado de la última operación" y dice que la suma que supera 16 bits se reparte en BX y AX; el comportamiento real del original con FFFF+1 no está confirmado.
- **Confirmar**: `ejemplo2026_3.txt` con 40000 y 30000. Esperado: `resultado menos sig 4464`, `reslutado mas sig 1`, `hay carry`. Para Z: `LDT / ADD 7 / JEQ 5 / MSG nocero / HLT / MSG cero / HLT / #7 / 1` con 65535. Esperado aquí: `nocero`.

## 3. SUB con préstamo

- **Decisión**: si AX < [mem], AX ← (AX − [mem]) mod 2^16 (complemento a dos), N=1 y C=1; si no, N=0 y C=0. O siempre 0.
- **Evidencia**: `ejemplo7.asm` con 5 y 3 espera `resultado en ax -2` y `resul nega` (salta con `jme`).
- **Confirmar**: `ejemplo7.asm` con 5 y 3. Esperado: `resultado en ax -2`, `resul nega`.

## 4. MUL siempre escribe BX; Z mira el producto completo

- **Decisión**: producto de 32 bits sin signo; AX ← bits bajos, BX ← bits altos (BX=0 cuando el producto cabe); O=1 solo si BX≠0; Z=1 solo si el producto es 0; N siempre queda en 0 (producto sin signo).
- **Evidencia**: la especificación describe el reparto en AX/BX y el Overflow; que BX se ponga en 0 cuando cabe es una decisión (la alternativa, dejar BX intacto, no tiene evidencia). Para N: la referencia rápida del curso (*Quickref - SimuProc*, versión del 1 de junio de 2016, no incluida en el repositorio) ("Resultado negativo") y la ayuda del flag en `reference/original/strings-ui-y-ejecucion.txt:902` ("1 si el resultado de la ultima Operacion = numero negativo"); un producto sin signo nunca es negativo. Con N sin tocar, `Ejemplo3.asm` (Editor 2) con 100 y 500 imprimía `Mult: -15536` por el N=1 que deja la resta.
- **Confirmar**: `#SimuProc 1.4.3.0 / LDT / MUL 10 / EAP menos / MOV AX,BX / EAP mas / HLT / #10 / 101` con entrada 3 y BX previamente distinto de 0 (p. ej. ejecutar antes `multiplica.asm` con 300 y 300 sin reiniciar). Esperado: `menos 15`, `mas 0`. Para N: `Ejemplo3.asm` (Editor 2) con 100 y 500. Esperado aquí: `Resta: -400`, `Mult: 50000`.

## 5. Flags de INC y DEC

- **Decisión**: INC escribe Z, C y O (FFFF+1 → 0000 con Z=C=O=1; N no cambia). DEC escribe Z y N (0000−1 → FFFF con N=1; C y O no cambian).
- **Evidencia**: novedades 1.4.3.0 ("INC no detectaba overflow") y la especificación ("DEC: si el destino queda = 0, se vuelve Z = 1").
- **Confirmar**: `LDT / INC AX / JC 5 / MSG sin carry / HLT / MSG carry / HLT` con entrada 65535. Esperado: `carry`.

## 6. Los saltos no tocan los flags (divergencia conocida)

- **Decisión**: ninguna instrucción de salto (JMP, JEQ, JNE, JME, JMA, JC, JNC, JO, JNO, LOOP) modifica Z, N, C u O. Tampoco lo hacen MOV, LDA, STA, PUSH, POP, EAP, MSG, etc.
- **Evidencia**: los programas del profesor hacen `add; eap; mov ax,bx; eap; jc` y esperan que `jc` todavía vea el acarreo. Sin embargo, novedades 1.1.0.24 y 1.4.3.0 sugieren que el original limpia N en los saltos condicionales salvo JMA/JME inmediatamente después de CMP, así que en el original `SUB` (negativo) → `JME` → `EAP` podría imprimir el valor sin signo.
- **Confirmar**: `LDT / STA 20 / LDT / SUB 20 / JME 6 / HLT / EAP r / HLT` con 5 y 3. Esperado aquí: `r -2`. Si el original imprime `r 65534`, el original limpia N en JME.

## 7. Valores negativos en pantalla

- **Decisión**: EAP y "Último Dato" muestran AX como negativo en complemento a dos solo cuando N=1 y el bit 15 de AX está en 1; en cualquier otro caso muestran el valor sin signo (0–65535).
- **Evidencia**: `Ejemplo3.asm` del curso con 9 y 4 (`resultado -5`) y `ejemplo7.asm`; novedades 1.1.0.24 habla de "números negativos" mostrados según el Negative Flag.
- **Confirmar**: `Ejemplo3.asm` (curso) con 9 y 4. Esperado: `resultado -5`. Con 4 y 9: `resultado 5`.

## 8. Celda con instrucción leída como dato

- **Decisión**: leer como dato una celda que contiene una instrucción (p. ej. `LDA 3` sobre `MOV AX,BX`) devuelve 0 y escribe un aviso en el panel "Ciclo del Procesador". No detiene la simulación.
- **Evidencia**: ninguna; el original guarda instrucciones como texto y no documenta el caso.
- **Confirmar**: `LDA 1 / EAP v / HLT`. Esperado aquí: `v 0`. Anotar qué hace el original.

## 9. Celda vacía leída como dato

- **Decisión**: vale 0, sin aviso.
- **Evidencia**: `Ejemplo4.asm` del curso y `ejemplosuma10.asm` leen legítimamente una celda vacía (LDB más allá de los datos) y el resultado esperado (50 y 100) exige que valga 0.
- **Confirmar**: `Ejemplo4.asm` (curso) con 5. Esperado: `parte menos significativa 50`.

## 10. Línea 3 del archivo .smp

- **Decisión**: las líneas 2 y 3 de un `.smp` cargado se conservan tal cual y se reescriben al guardar. Para un programa nuevo se escribe `1ba` y, como marcador, el hexadecimal de (número de saltos de línea + 1): coincide con el `23` de `Calcula Paridad de un Numero.smp` pero no con el `221` de `Calcula Numeros Primos.smp`. El significado real es desconocido y **no está verificado**; el original ignora el valor al abrir (o al menos abre ambos archivos).
- **Confirmar**: guardar un programa nuevo como `.smp` y abrirlo en el original. Si lo rechaza, cambiar `serializeSmp` en `src/core/formats/smp.ts`.

## 11. Ambigüedad LDA / dato al cargar .smp

- **Decisión**: al cargar un `.smp`, una celda cuyo texto decodifica como instrucción se marca `instr`; el resto `data`. Los únicos textos ambiguos son `01` seguido de 1–3 dígitos 0/1 (p. ej. `0110`, que es `LDA 10` y también el dato binario 0110). Se muestran como instrucción; la CPU los interpreta según cómo se usen, igual que el original.
- **Evidencia**: `multiplica.asm` guarda `lda 10` como `0110`.
- **Confirmar**: no afecta a la ejecución; solo a la columna Valor de la lista de memoria.

## 12. Datos decimales en el Editor 2

- **Decisión**: una línea de dígitos con algún 2–9 (`20`, `128`, `255`) se acepta como decimal 0–65535 y se guarda en binario, con el aviso "interpretado como decimal; el original solo acepta binario".
- **Evidencia**: `leedat.asm` del profesor usa `20 30 128 64 255` y la salida esperada del curso es `Dato leido 20 … 255`.
- **Confirmar**: cargar `leedat.asm` en el Editor 2 del original y enviarlo a memoria. Si el original lo rechaza, el profesor lo probó en otra versión; aquí se mantiene el aviso.

## 13. Palabra binaria de más de 16 dígitos

- **Decisión**: error `INSTRUCCION NO VALIDA en la Dir: X`, acompañado del aviso "dato binario de N dígitos; cada posición de memoria guarda 16 bits (divídalo en dos posiciones)". La línea ocupa su dirección (queda vacía) y las siguientes se cargan en las direcciones que les corresponden. Por ejemplo, el dato `110000010100010101101111` (24 dígitos = 12 617 071) no cabe en una palabra; el comportamiento del original es desconocido.
- **Confirmar**: escribir `111111111111111111111111` en el Editor 2 del original y enviarlo a memoria. Anotar el mensaje.

## 14. Ejecutar una celda en blanco

- **Decisión**: error fatal "Intento de ejecución de una posición de memoria en blanco en la Dir: XXX / Su programa es erroneo o no tiene la instrucción 99 - HLT". La opción "Ignorar instrucciones no reconocidas" no lo evita.
- **Evidencia**: los dos textos existen en el binario del original.
- **Confirmar**: `MSG hola` sin HLT. Esperado: el error en la Dir 001.

## 15. Ejecutar una celda de datos

- **Decisión**: el texto de la celda se decodifica como opcode (dos dígitos) + operandos; si falla, error ignorable "Codigo de Operación no Válido" con la dirección de la celda (PC ya apunta a la siguiente). Con la opción "Ignorar instrucciones no reconocidas" se salta en silencio (queda una línea en el ciclo).
- **Evidencia**: `ejemplo6.asm` del profesor sobrescribe su HLT (00F) con el primer dato (`sta 0f`) y el texto `1001110001000000` (40000) decodifica como opcode 10 con operandos inválidos.
- **Confirmar**: `ejemplo6.asm` con 40000 y 30000. Esperado: las tres líneas de salida y luego el error en la posición 00F.

## 16. Pila: dirección de crecimiento y orden de PUSH/POP (inferido)

- **Decisión**: la pila ocupa BP..FFF y crece hacia arriba. `PUSH reg`: mem[SP] ← reg, luego SP ← SP+1. `POP reg`: si SP = BP, error "La pila esta vacía, uso indebido de POP." (ignorable); si no, SP ← SP−1 y reg ← mem[SP]. Con BP = F80 caben 128 valores; SP muestra `1000` con la pila llena y el push 129 produce "Pila Llena o Stack Overflow! Reserve mas espacio para la Pila cambiando BP." (fatal).
- **Evidencia**: la especificación dice que bajar BP de F80 a CF1 "reserva más espacio para la pila", y el mensaje de desbordamiento pide cambiar BP. La referencia rápida de 2016 escribe `SP ← SP−1` en PUSH, pero contradice esas dos fuentes.
- **Confirmar**: `1 cargaypush.asm`. Esperado: tras HLT, la posición F80 contiene 0000000001100111 (103), BX = 103 y SP = F80. Para el sentido de crecimiento: `PUSH AX / PUSH AX / HLT` y mirar si SP queda en F82 (aquí) o en F7E.

## 17. Indicador de uso de la pila

- **Decisión**: (SP − BP) / (1000h − BP), en porcentaje.
- **Confirmar**: con BP = F80 y 64 PUSH el indicador marca 50 %.

## 18. Escribir BP reinicia SP

- **Decisión**: `MOV BP,x`, `POP BP`, `INC BP` y `DEC BP` validan que el valor sea una dirección 000–FFF (si no: "Se ha intentado copiar un Valor no Válido a BP", ignorable) y dejan SP = BP.
- **Evidencia**: la especificación describe `MOV BP,3B` para mover la base de la pila; sin reiniciar SP, la pila quedaría inconsistente.
- **Confirmar**: `MOV BP,10 / PUSH AX / HLT` con `#10 / 110011110001` (CF1). Esperado: BP = CF1 y SP = CF2 después del PUSH.

## 19. Representación de la fuente de MOV BP

- **Decisión**: la celda fuente se lee como dato binario (`110011110001` = CF1). Si la celda no contiene un número binario (p. ej. una instrucción o el texto `CF1`), se produce el error de valor no válido para BP en lugar de leer 0.
- **Evidencia**: el mensaje del original dice que BP "solo acepta direcciones en hexa", lo que podría indicar que el original lee el texto de la celda como hexadecimal. Como todo dato del simulador es binario, se eligió binario.
- **Confirmar**: escribir en la posición 10 el dato `110011110001` y ejecutar `MOV BP,10 / HLT`. Si el original deja BP = CF1, coincide; si muestra el error, el original espera texto hexadecimal (`CF1`) en la celda.

## 20. IN registro,1 escribe siempre BX:AX

- **Decisión**: el puerto 1 lee un número real (o entero, negativo permitido) y guarda su IEEE 754 de 32 bits en BX (alta) y AX (baja), sin importar el registro escrito en la instrucción.
- **Evidencia**: `Ejemplo5.asm` y `Ejemplo6.asm` del original usan `IN AX,1` seguido de `STF`, que guarda BX y AX.
- **Confirmar**: `IN CX,1 / OUT 1,AX / HLT` con 2.5 por el puerto 1. Esperado: `2.5`.

## 21. ITOF y FTOI con signo

- **Decisión**: ITOF interpreta AX como entero de 16 bits en complemento a dos (FFFE → −2). FTOI trunca hacia cero y guarda el entero en complemento a dos de 16 bits; O=1 si |entero| > 65535; Z y N según el entero convertido (−0.5 → AX=0 con Z=1 y N=0).
- **Evidencia**: la especificación dice "N si el número es negativo" para ambas conversiones, lo que exige signo, y para FTOI dice que los flags cambian "de acuerdo al número convertido" (especificación del curso *Instrucciones Soportadas en SimuProc 1.4.3*, no incluida en el repositorio).
- **Confirmar**: `LDT / ITOF / OUT 1,AX / HLT` con 65534. Esperado aquí: `-2`. Si el original imprime `65534`, ITOF es sin signo.

## 22. Redondeo de punto flotante

- **Decisión**: cada operación (ADDF, SUBF, MULF, DIVF, ITOF) redondea su resultado a precisión simple (`Math.fround`); OUT 1 imprime con 4 decimales y elimina los ceros finales (opciones de "Configurar SimuProc" por defecto). DIVF deja en CX el residuo `trunc(a mod b)` como entero de 16 bits.
- **Evidencia**: la especificación fija IEEE 754 de 32 bits; `Ejemplo5.asm` espera `1.6667` para 2.5/1.5.
- **Confirmar**: `Ejemplo5.asm` con 2.5 y 1.5 por el puerto 1. Esperado: `4`, `1`, `3.75`, `1.6667`.

## 23. Mensajes de error de STB, LDF y STF

- **Decisión**: el error por superar el final de la memoria usa el mnemónico de la instrucción que lo produjo. El original muestra "LDB: Error" y "…de mem de LDB" también para STB (copia y pega del binario).
- **Confirmar**: `STB FFF / HLT` con BX = 1. Aquí: "STB: Error". En el original: "LDB: Error".

## 24. Alias XBA

- **Decisión**: el Editor 2 acepta `XBA` como alias de `XAB` (código 03) con un aviso, porque la referencia rápida de 2016 lo escribe así. Ningún otro mnemónico de x86 se corrige.

## 25. Ejecutar después de terminar

- **Decisión**: si el programa terminó (HLT o error fatal) y se pulsa Ejecutar o Paso a paso, los registros se reinician automáticamente (PC = 000, SP = BP, flags 0, AX = BX = CX = 0) antes de ejecutar. En el original hay que usar "Reiniciar Registros". Una terminación manual (Reiniciar Registros durante la ejecución, "Cancelar" en el Vigilante de Memoria o detener para abrir otro programa) también reinicia los registros; la memoria no se toca.

## 26. Estadísticas

- **Decisión**: cada instrucción decodificada cuenta como ejecutada antes de ejecutarse; un código de operación no reconocido no cuenta. Clases: saltos condicionales (JEQ, JNE, JME, JMA, JC, JNC, JO, JNO, LOOP), incondicionales (JMP), push, pop, comparaciones (CMP), lógicas (AND, OR, XOR, NOT), aritméticas (ADD, SUB, MUL, DIV, ADDF, SUBF, MULF, DIVF, ITOF, FTOI), desplazamientos (ROL, ROR, SHL, SHR), entrada (LDT, IN) y salida (EAP, MSG, OUT). INC y DEC no cuentan en ninguna clase.
- **Evidencia**: en `reference/original/strings-ui-y-ejecucion.txt` los textos de cada instrucción terminan con el literal de su clase: `matematica` tras ADD, SUB, MUL y DIV (1845, 1852, 1859, 1874), tras ADDF, SUBF, MULF y DIVF (1982, 1990, 2000, 2019) y tras ITOF y FTOI (2024, 2028). Los textos de INC y DEC (1545-1570) no tienen ningún literal de clase, igual que MOV.

## 27. Comentario en líneas LDT, EAP y MSG

- **Decisión**: un `;comentario` en una línea LDT/EAP/MSG se descarta al ensamblar: la celda solo tiene una ranura de comentario y la ocupa el mensaje (el Editor 1 del original lo muestra como "comentario").
- **Evidencia**: formato `.smp` (una línea de texto y una de comentario por celda).

## 28. Texto de los datos en memoria

- **Decisión**: los datos escritos por la CPU (STA, STB, STF, PUSH, INC/DEC en memoria…) se guardan como binario mínimo (`0` para cero, `1100111` para 103), igual que `Calcula Numeros Primos.smp`. Los datos tipeados en el editor conservan su texto (ceros a la izquierda incluidos); la lista de memoria siempre los muestra con 16 dígitos.

## 29. Comillas y comentarios

- **Decisión**: el `;` que inicia un comentario tiene que estar fuera de comillas. Una comilla sin cerrar (`EAP "EL RESULTADO ES`) arrastra el resto de la línea al mensaje, sin aviso. Se quita solo un par de comillas iguales, o una comilla inicial sin cierre; los espacios interiores se conservan (`eap igual   menos sig` → `igual   menos sig`).
- **Evidencia**: `suma simple.asm` y `multiplica.asm` del profesor.

## 30. Vigilante de Memoria: cuándo pausa

- **Decisión**: con "Pausar Simulación" la simulación se pausa después de la instrucción que cambió el valor vigilado (el diálogo muestra el valor anterior y el nuevo). Con "Pausar solo si el Valor es =" se pausa cuando el valor *pasa a ser* igual al indicado (no en cada instrucción mientras siga igual). "No" en el diálogo desactiva esa condición para la posición; "Cancelar" termina la simulación manualmente. El historial guarda los últimos 5 valores distintos. Si la pausa llega con "Paso a paso", "Sí" y "No" dejan la simulación en pausa (un paso no se convierte en una ejecución continua). Al cargar un programa, con "Nuevo" y al activar una posición, el valor de referencia pasa a ser el contenido actual de la celda, así que la primera instrucción no informa un cambio que el programa no hizo. El valor de "Pausar solo si el Valor es =" se lee en binario, como las celdas (`10` es 2); para un decimal se escribe con sufijo `d` (`10d` es 10). Un valor con dígitos distintos de 0 y 1 (`12`) se lee en decimal.
- **Evidencia**: los tres textos del diálogo existen en el binario; la semántica de transición es una decisión para evitar pausas infinitas. El comportamiento con "Paso a paso" y el valor de referencia al cargar no están documentados en `reference/`; son decisiones. Del valor a comparar solo se conserva el comienzo del hint del original, "Escriba un Valor para que la Simulaci…" (`reference/original/captions-formularios.txt:599`, cortado en la extracción); la lectura en binario y el sufijo `d` son decisiones. El diálogo repite el valor tal como se escribió ("especificado por ud").

## 31. Estadísticas: tiempo y velocidad

- **Decisión**: la duración solo cuenta el tiempo en estado "Simulando" (no el tiempo esperando un dato del teclado ni las pausas). Velocidad = instrucciones / duración, mostrada en Hz, mHz o µHz con las notas del original. "Resetear estadísticas" (activo por defecto) pone todo en cero al ejecutar desde la dirección 000. El tiempo con un diálogo de error abierto (preguntas Sí/No) tampoco cuenta, y cargar un programa o "Nuevo" ponen en cero la duración y el encabezado. El encabezado de la ventana mantiene la línea fija "El Programa en Memoria" y debajo la frase que cambia: "mostrará acá sus estadistícas…" antes de ejecutar, "ha terminado su ejecución con éxito, estas son las estadísticas del programa:" tras HLT y "ha sido interrumpido, estas son las estadísticas del programa:" tras una terminación manual.
- **Evidencia**: el formulario TEstadis tiene dos etiquetas separadas (`reference/original/captions-formularios.txt:319-320`, `reference/original/smpr_esp.lng:387-388`), y las frases variables del binario empiezan con el verbo (`reference/original/strings-ui-y-ejecucion.txt:1222-1223` y `:2104-2107`).

## 32. PC Speaker (puerto 13)

- **Decisión**: `OUT 13,reg` suena con la frecuencia del registro y la duración de BX en ms (máximo 10 s por sonido), en onda cuadrada por WebAudio; el navegador exige un gesto del usuario previo (pulsar Ejecutar basta). Frecuencias fuera de 7–32767 Hz no suenan y dejan una línea en el ciclo; el original muestra ese rango en la ayuda del puerto. Los sonidos seguidos se oyen uno después del otro, como una melodía, y no a la vez. El programa no espera a que termine cada sonido (divergencia): los sonidos quedan en cola, con un máximo de 10 s de sonido pendiente; los que llegan con la cola llena se descartan sin aviso. Detener la simulación, "Nuevo" o cargar otro programa cortan los sonidos pendientes; un programa que termina con HLT deja sonar los que quedan.
- **Evidencia**: la ayuda del puerto da la duración en ms leída de BX y una fórmula para las frecuencias de las notas musicales (`reference/original/strings-ui-y-ejecucion.txt:1236-1250`), que solo sirve si los sonidos suenan en orden. Que el programa no se detenga durante el sonido y el tope de la cola son decisiones de esta versión.
- **Confirmar**: en el original, medir si `OUT 13` detiene la simulación durante los BX ms del sonido.

## 33. Switches (puerto 9)

- **Decisión**: `IN reg,9` devuelve el valor de 16 bits de la ventana "Switches - Puerto 9" (bit F el más significativo), 0 si no se ha tocado ningún interruptor.

## 34. Textos del ciclo de ejecución

- **Decisión**: las líneas de micro-pasos siguen la tabla de textos del binario. MUL no tiene línea de Overflow; en ADD la línea "Después de Realizada la SUMA…" va antes de "Como hubo Overflow…". OR y XOR llevan el nombre entre comillas (`"O inclusive lógico"`, `"O exclusivo"`) donde el original las pone. ROL, ROR, SHL y SHR terminan con "veces." y escriben solo `Escribo <valor> en <destino>`. LDB y STB terminan con "posiciones."; el número de posiciones se muestra en decimal (inferido: el binario solo muestra el sufijo). ADDF y SUBF dicen "Pos de Mem" y MULF y DIVF "Dir de Mem"; la línea de Overflow de ADDF no lleva coma.
- **Evidencia**: `reference/original/strings-ui-y-ejecucion.txt`: ADD 1841-1844 y MUL 1853-1858; OR 1634-1649 y XOR 1659-1668; desplazamientos 1678-1808; LDB y STB 1933-1947; ADDF a DIVF 1975-2009. El orden de ADD se deduce del orden de la tabla de textos.
- **Confirmar**: con animación, `LDB 20 / HLT` con BX = 101. Esperado aquí: `LDB: 020 a esta dirección le sumo el valor de BX: 5 posiciones.` Si el original muestra `101 posiciones.`, el número va en binario.

## 35. Límite de los números flotantes

- **Decisión**: el teclado del puerto 1 acepta de −2147483647 a 2147483647, pero en precisión simple esos extremos se redondean a ±2^31 (2147483648). Las operaciones flotantes marcan Overflow solo si el resultado supera ese valor redondeado, así que un dato aceptado por el teclado no produce Overflow por sí solo (0 + 2147483647 → O=0). MULF con Overflow deja ±2147483648, que es el 2147483647 de la especificación en precisión simple.
- **Evidencia**: la especificación del curso *Instrucciones Soportadas en SimuProc 1.4.3* (no incluida en el repositorio) da como válidos los valores "desde -2147483647 hasta 2147483647" y activa Overflow solo si una operación "sobrepasa este valor", y fija el resultado de MULF en 2147483647 ("Si el resultado es > 2147483647, Resultado = 2147483647"), que no es representable en 32 bits. El comportamiento del original con estos extremos no está confirmado.
- **Confirmar**: `IN AX,1 / STF 20 / LDF 22 / ADDF 20 / JO 7 / MSG sin overflow / HLT / MSG overflow / HLT / #22 / 0 / 0` con 2147483647 por el puerto 1. Esperado aquí: `sin overflow`.

## 36. Programas que no caben en la memoria

- **Decisión**: la memoria tiene 4096 posiciones (000–FFF) y nada se escribe fuera de ellas. En el Editor 2, la primera línea que cae después de FFF da un solo error `SE LLENO LA MEMORIA (línea N)` (otro más solo si una directiva `#HEX` vuelve atrás y el texto se desborda de nuevo). "Convertir a Editor 1" no crea filas para esas líneas. Una fila del Editor 1 con dirección mayor que FFF da `SE LLENO LA MEMORIA (Dir: XXXX)` al enviarla a memoria. Un `.smp` con una posición escrita (texto o comentario) después de FFF se rechaza con `NO es un archivo Válido Para Abrir en este Simulador.` antes de tocar la memoria; los pares vacíos del final se ignoran.
- **Evidencia**: `reference/original/smpr_esp.lng:337` (`s11=SE LLENO LA MEMORIA`, un solo texto, sin número de línea) y `reference/original/smpr_esp.lng:308` (`v8=NO es un archivo Válido…`). El número de línea o de dirección es un añadido de SimuProc Web.
- **Confirmar**: en el Editor 2 del original, `#FFF`, `HLT`, `NOP`, `NOP` y enviar a memoria. Anotar si el mensaje sale una vez o una por línea.

## 37. Líneas `#` que parecen directivas

- **Decisión**: solo `#` seguido de 1 a 3 dígitos hexadecimales (con `h` opcional) es una directiva de dirección; cualquier otra línea `#` es un comentario. Si la línea parece una directiva mal escrita (`#1000`, `#FFFF`, `#0x20`, `# 20`, o un número con dígitos seguido de texto como `#20 datos`) se toma igual como comentario, pero con un aviso: "fuera de rango" si pasa de FFF, "no es una directiva válida" en otro caso. `#iteracionesd con salto`, `#ACE de datos` o `# de la suma` no dan aviso.
- **Evidencia**: los ejemplos del curso usan `#` como comentario (`src/ejemplos/curso/2 iterajmp.asm:2`) y directivas en minúscula (`src/ejemplos/curso/Ejemplo4.asm:22` `#f0`, `src/ejemplos/curso/leedat.asm:10` `#f`). La ayuda del original no documenta la directiva.
- **Confirmar**: `#1000` / `HLT` en el Editor 2 del original. Si da error, cambiar el aviso por un error en `src/core/formats/asm.ts`.

## 38. MSG sin mensaje

- **Decisión**: MSG necesita un mensaje en todas las entradas. La "Entrada de Instrucciones Manualmente" rechaza MSG con el comentario vacío con el texto "Escriba el mensaje de MSG en el comentario." (texto propio de SimuProc Web; el original no tiene uno para este caso). "Modificar una Posición de Memoria" hace lo mismo con `MSG` sin mensaje si la celda tampoco tiene comentario; si lo tiene, ese comentario sigue siendo el mensaje. Así un programa guardado como `.asm` siempre se puede volver a abrir.
- **Evidencia**: el Editor 2 y el Editor 1 ya rechazan un `MSG` sin mensaje con `PARAMETRO NO VALIDO` (`src/core/formats/asm.ts`, `src/core/formats/editor1.ts`); la lista de instrucciones del original lo escribe `42 - MSG "mensaje"` (`reference/original/smpr_esp.lng:264`).
- **Confirmar**: en el original, Entrada Manual → MSG sin comentario → OK. Anotar si lo acepta.

## 39. Mensajes con comillas `'` y `"` al guardar como .asm

- **Decisión**: al escribir un mensaje de LDT, EAP o MSG en el Editor 2 o en un `.asm` se usa `'msg'`, o `"msg"` si el mensaje tiene `'`, como antes; esa forma siempre se lee de vuelta igual cuando el mensaje no mezcla `'` y `"`. Solo si no sirve se prueba, en orden, `msg`, `'msg` y `"msg`, y se usa la primera que se lee de vuelta igual (reglas de la sección 29). Si ninguna sirve (mezcla `'`, `"` y `;`, o espacios al borde), se escribe sin comillas y `disassembleWithWarnings` da el aviso `mezcla comillas ' y " y no se puede guardar como .asm sin perder texto`. "Guardar" y "Guardar Como" en formato `.asm` descargan el archivo igual y después muestran esos avisos en una caja titulada "Advertencia". El `.smp` guarda siempre el mensaje completo.
- **Evidencia**: sección 29; el `.smp` guarda el mensaje en la línea de comentario tal cual; la lista de instrucciones del original escribe el mensaje entre comillas dobles (`reference/original/smpr_esp.lng:264`, `42 - MSG "mensaje"`), así que `"msg"` se mantiene para mensajes con `'`.

## 40. Conversión de bases: dígitos de Base 10 y número de veces 0

- **Decisión**: el campo Base 10 de la sección de punto flotante muestra el valor float32 con el mínimo de cifras significativas (máximo 9) que, escritas de nuevo, dan el mismo float32. En la Entrada Manual, un número de veces 0 en ROL/ROR/SHL/SHR da `Número de veces NO válido…` (e19) en vez de `Numero de veces muy grande…` (e16).
- **Evidencia**: 9 cifras bastan para cualquier float32 (IEEE 754) y 8 no alcanzan para cerca del 1 % de los valores (p. ej. los bits `08A805A2`). `reference/original/smpr_esp.lng:165` (e16) y `:168` (e19); el original no documenta qué mensaje da para 0.
- **Confirmar**: Entrada Manual → `SHL` con `AX,0` en el original. Anotar el mensaje.

## 41. Cargar otro programa

- **Decisión**: abrir un archivo, cargar un ejemplo `.smp`, "Enviar a Memoria" y "Nuevo" reinician todo lo ligado al programa anterior: registros, estadísticas (ver 31), resaltados, el valor de referencia del Vigilante (ver 30) y la lista de "Entrada de Instrucciones Manualmente". "Borrar" dice "No hay nada que Borrar!!" en vez de borrar una celda del programa nuevo, y la siguiente instrucción manual va a la 000. En "Enviar a Memoria" con una simulación en curso se hacen las dos preguntas ("Detener Simulación para abrir otro programa?" y "Ya existe un Programa en Memoria Principal / Sobrescribir con este?") antes de detener nada: un "No" a la segunda deja la simulación como estaba.
- **Evidencia**: los textos existen en el original (`reference/original/smpr_esp.lng:323`, `reference/original/strings-ui-y-ejecucion.txt:2703-2704`); el tooltip de "Borrar" habla de la última instrucción entrada (`reference/original/smpr_esp.lng:126`). El orden de las preguntas y qué se reinicia al cargar no están documentados; son decisiones.
- **Confirmar**: en la entrada manual agregar dos `NOP`, abrir `suma simple.asm` y pulsar "Borrar". Esperado: "No hay nada que Borrar!!" y el programa intacto.

## 42. Guardar, Guardar Como y Salir

- **Decisión**: "Salir" con un programa modificado (entrada manual, "Modificar una Posición de Memoria", "Enviar a Memoria") pregunta primero "El Programa en Memoria ha Cambiado / Desea Guardarlo??" con título "Mensaje de SimuProc" y botones Sí, No y Cancelar. "Sí" guarda (o abre "Guardar Como" si el programa no tiene nombre), "Cancelar" no sale. Como el navegador no deja que la página cierre su propia pestaña, después se muestra el aviso de cerrar la pestaña. Mientras el programa esté modificado, cerrar o recargar la pestaña pide confirmación del navegador. "Nuevo" y "Abrir" no preguntan. En "Guardar Como", escribir una extensión `.smp`, `.asm` o `.txt` elige el formato, y el nombre guardado siempre lleva la extensión del formato (`prueba` se guarda como `prueba.smp`). "Abrir" reconoce un archivo `.smp` por su contenido (empieza con "SimuProc") aunque tenga otra extensión.
- **Evidencia**: el texto y su título existen en el original (`reference/original/smpr_esp.lng:321-322`) y en el binario están justo después de la rutina de guardar (`reference/original/strings-ui-y-ejecucion.txt:109-114`). Los botones y en qué acciones se pregunta no están en `reference/`; son decisiones.
- **Confirmar**: en el original, agregar una instrucción manual y cerrar el programa. Esperado: la pregunta "Desea Guardarlo??"; anotar sus botones y si también aparece con "Nuevo" o "Abrir".

## 43. Flags: se fuerzan con doble clic

- **Decisión**: Z, N, C y O cambian con doble clic en su valor, no con un clic. Con el teclado, Enter o Espacio sobre el flag lo cambian (accesibilidad; el original no da foco a esas etiquetas).
- **Evidencia**: los manejadores del binario son `ZvalorDblClick`, `NvalorDblClick`, `OvalorDblClick` y `CvalorDblClick` (`reference/original/strings-ui-y-ejecucion.txt:1412-1419`); no hay ningún `*valorClick`. El hint de Z dice "le puede dar Doble Click para un cambio forzado" (`reference/original/smpr_esp.lng:99`).
- **Confirmar**: un clic en el valor de Z no lo cambia; un doble clic lo pone en 1.

## 44. Ayuda de puertos: título "Dispositivos"

- **Decisión**: los textos de ayuda de los puertos (menú Dispositivos) se muestran en un diálogo titulado "Dispositivos", no con el caption del ítem del menú. "1 - Teclado y Pantalla (E y S) ..." abre la ventana "Dispositivos de E/S" y además muestra la ayuda del puerto 1.
- **Evidencia**: en `reference/original/strings-ui-y-ejecucion.txt:1229`, `:1235` y `:1256` cada texto de ayuda (puerto 1, reloj, PC Speaker) va seguido de `Dispositivos`: el par Texto/Caption de un message box en `PantallaytecladoClick`, `RelojClick` y `PCSpeakerClick` (`:1447-1450`).
- **Confirmar**: Dispositivos > 8 - Reloj (E). Esperado: una caja titulada "Dispositivos" con el ejemplo `IN BX,8`.

## 45. Modificar Memoria: caption del flag N

- **Decisión**: la casilla del flag N dice `N (Negative ó Sign Flag)`.
- **Evidencia**: `reference/original/captions-formularios.txt:556` corta el caption en la "ó" (`N (Negative `) y el hint de la línea 402 es `Negative o Sign Flag`. En el DFM de `TModificaMem` del binario desempaquetado el caption completo es `N (Negative ó Sign Flag)` (cadena UTF-8 de 25 bytes).

## 46. Entrada manual: dirección no válida

- **Decisión**: si el campo Dir tiene una dirección no válida, Ok no escribe nada: quedan visibles el error (e21 o e23) y el texto tipeado, para corregirlo.
- **Evidencia**: los mensajes son del original (`reference/original/smpr_esp.lng:170` y `:172`); una dirección rechazada no puede terminar escribiendo la instrucción en otra dirección.
- **Confirmar**: Entrada Manual, HLT, Dir `G00`, Ok. Esperado: "Valor Hexa no Válido, entre valores solo entre 0-9 y A-F" y la memoria sin cambios.

## 47. Diálogos modales y Escape

- **Decisión**: un diálogo abierto se queda con el foco (Tab y Shift+Tab giran dentro de él) y lo devuelve al control anterior al cerrarse, como los formularios modales de Windows. Escape cierra solo el diálogo de arriba; un mensaje (Sí/No, Aceptar) no se cierra con Escape, y mientras está abierto tampoco se cierra el diálogo de abajo.
- **Evidencia**: el original usa formularios modales y `MessageBox` de Windows, que bloquean la ventana de abajo.
- **Confirmar**: en Windows, Escape responde una caja que solo tiene Aceptar (convención de `MessageBox`); aquí se ignora. Revisar si conviene imitarlo.

## 48. Conversión de bases: texto no válido en un campo

- **Decisión**: solo el campo que se está editando puede quedar con texto no válido. Al editar otro campo (con un valor válido, no válido o vacío) o al cambiar la Base, los demás campos vuelven a mostrar el último valor válido, y el error visible es siempre el del campo editado o el de la Base.
- **Evidencia**: `reference/` no describe este caso. El hint "Rango de Teclas admitidas para la base Seleccionada" (`reference/original/captions-formularios.txt:153`) sugiere que el original limita las teclas de cada campo, de modo que no llega a mostrar dos campos que se contradicen (no verificado en el binario). Aquí se puede tipear o pegar texto no válido, así que un campo así no debe quedar sin aviso al lado de los demás.
- **Confirmar**: Decimal `12x`, luego flecha arriba en Base. Esperado: Decimal vuelve a `12`, sin error.

## 49. Archivos demasiado grandes

- **Decisión**: "Abrir Programa..." y "Cargar un programa desde un archivo" rechazan sin leerlo un archivo de más de 1 MiB con `NO es un archivo Válido Para Abrir en este Simulador.`, como un archivo que no se puede leer. Ese límite deja mucho margen sobre cualquier programa de 4096 posiciones. Las listas de errores del Editor y de "Errores Encontrados" muestran los primeros 50 y una línea `… y N más`.
- **Evidencia**: el texto es del original (`reference/original/smpr_esp.lng:308`, `v8`). El límite y el corte de las listas son decisiones de SimuProc Web para que un archivo equivocado no deje la página sin responder.
