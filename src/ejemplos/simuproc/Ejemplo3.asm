#SimuProc 1.4.3.0
 ;Ejemplo 3:
 ;Cómo pedirle datos al Usuario...
 ;Este programa muestra cómo pedir datos al usuario
   MSG 'Programa Ejemplo 3'  ;Muestro el mensaje en Pantalla
   MSG 'Pedire dos numeros y realizare las operaciones aritmeticas basicas'
   LDT 'Entre el Primer numero' ;Leo del teclado un numero que pedire al usuario, este luego sera llevado a AX
   MOV 1C,AX   ;guardo el primer numero en 1C
   LDT 'Entre el Segundo Numero'
   MOV 1D,AX   ;Guardo el segundo numero en 1D
   ADD 1C      ;AX = AX + 1C
   EAP 'Suma:' ;Muestro el Valor de AX en pantalla
   MOV AX,1C   ;AX = contenido de 1C  o sea cargo en AX el primer numero
   SUB 1D      ;AX = AX - 1D
   EAP 'Resta:'
   MOV AX,1C   ;cargo en AX el primer numero
   MUL 1D      ;AX = AX * 1D   Multiplicacion
   EAP 'Mult:' ;Muestro el Valor de AX en pantalla
   MOV AX,1C   ;AX = contenido de 1C  o sea cargo en AX el primer numero
   DIV 1D      ;AX = AX / 1D  en BX queda el residuo
   EAP 'Div:' ;Muestro el Valor de AX en pantalla
   HLT        ;Fin del Programa
