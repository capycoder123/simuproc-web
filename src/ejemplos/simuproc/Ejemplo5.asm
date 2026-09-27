#SimuProc 1.4.3.0
 ;Ejemplo 5:
 ;Operaciones con numeros de punto flotante...
   MSG 'Programa Ejemplo 5'  ;Muestro el mensaje en Pantalla
   MSG 'Numeros IEEE 754' ;Son numeros de punto flotante o enteros desde -2GB hasta 2GB
   MSG 'Entre el primer numero..(puede ser negativo)'  ;Muestra un mensaje en la pantalla
   IN    AX,1              ; Lee del Puerto 1 (El teclado, puerto 1 para leer numeros flotantes) (Para estos numeros se usa esta instruccion y no LDT)
   STF   1A                ; Almaceno el numero de 32 bits en 1A y 1B, en 1A quedan los 16 bits mas significativos y en 1B los 16 menos significativos
   MSG 'Entre el sgdo numero:' ;Puede ser un entero muy grande tambien, positivo, negativo, o de punto flotante
   IN    AX,1
   STF   1C
   MSG 'Suma:'
   ADDF  1A                ;Suma para numeros IEEE 754 de 32 bits   Sumo BX y AX con 1A y 1B, resultado queda en BX y AX
   OUT   1,AX              ;El equivalente a EAP pero para estos numeros,  Escribo en pantalla el numero formado por los 32 bits de BX y AX
   LDF   1A                ;Cargo en los registros BX y AX el numero almacenado en 1A y 1B, en BX quedan los 16 bits mas significativos, y en AX los 16 bits menos significativos
   SUBF  1C                ;Resta de numeros de punto flotante, Tambien despues de esta instruccion se pueden usar saltos condicionales, porque es como una CMP para estos numeros
   MSG 'Resta:'
   OUT   1,AX
   LDF   1A
   MULF  1C
   MSG 'Mult:'
   OUT   1,AX
   LDF   1A
   DIVF  1C
   MSG 'Div:'
   OUT   1,AX
   HLT                     ;Fin del Programa
