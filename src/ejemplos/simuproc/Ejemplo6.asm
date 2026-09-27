#SimuProc 1.4.3.0
 ;Ejemplo 6:
 ;Ejemplo de un Programa sencillo que halla la raiz cuadrada de un numero
;El algoritmo para hallar la Raiz cuadrada de un numero, es el siguiente:
;   leo numero                              //Al que le voy a sacar la raiz.
;   y=1                                     //inicializo y en 1
;   raiz = 2                                //inicializo raiz en 2
;   mq (y != raiz) ó (y != raiz+1) haga     //Hago un Bucle que no termine hasta que 'y' sea diferente de raiz o raiz+1
;       raiz = y
;       y = ( y + ( numero / y )) / 2
;   fin mq
;   imprimo raiz
;Ahora lo programaremos en Assembler asi:
;Grabare las variables en memoria asi:
; 2A   numero
; 2C   raiz
; 2E   y
   MSG 'Programa Ejemplo 6'
   MSG 'Entre un numero para Calcularle la Raiz Cuadrada'
   IN AX,1               ;Leo el numero al que le calculare la Raiz Cuadrada
   STF 2A                ;Grabo el numero en la dir 2A y 2B
   LDF 30                ;Cargo el numero 1 en los registros
   STF 2E                ;y = 1
   LDF 32                ;Cargo el numero 2 en los registros
   STF 2C                ;raiz = 2
   ;Aca comienza el Bucle MQ
   LDF 2E                ;Cargo y en los registros
   SUBF 2C               ;Comparo 'y' con Raiz  (Nota, puedo usar SUBF para las comparaciones con numeros IEEE 754)
   JEQ 17                  ;Si son iguales, salto al fin del ciclo
   LDF 2C                ;Cargo Raiz en registros
   ADDF 30               ;Le sumo 1
   SUBF 2E               ;Comparo Raiz+1 con 'y'    (con la resta en los registros de control quedan los resultados, para luego tomar la decision)
   JEQ 17                 ;si raiz+1 es igual a 'y', salto al fin del ciclo
    ;terminada la condicion, ejecuto lo que esta dentro del bucle MQ
   LDF 2E                ;Cargo 'y' en registros
   STF 2C                ;raiz = y
   LDF 2A                ;Cargo en registros, numero
   DIVF 2E               ;Registros = numero / y
   ADDF 2E               ;Registros = Registros + y
   DIVF 32               ;Registros = Registros / 2
   STF 2E                ;y = al valor de los registros BX y AX
   JMP 8                 ;Vuelvo al Ppio del Ciclo  (FIN CICLO)
   LDF 2C                ;Cargo el valor de raiz en registros BX y AX
   MSG 'La Raiz es:'
   OUT 1,AX              ;Muestro la raiz calculada
   HLT                   ;Termina el programa
  ;Inicializo las constantes 1 y 2 en IEEE 754
#30
0011111110000000    ;Inicializo el Numero 1 en la dir 30 y 31
0000000000000000
0100000000000000    ;numero 2 en la dir 32 y 33
0000000000000000
