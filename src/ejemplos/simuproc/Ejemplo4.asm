#SimuProc 1.4.3.0
 ;Ejemplo 4:
 ;Cómo Tomar decisiones...
   MSG 'Programa Ejemplo 4'  ;Muestro el mensaje en Pantalla
   MSG 'Toma de Decisiones'
   LDT 'Entre un numero' ;Leo del teclado un numero que pedire al usuario, este luego sera llevado a AX
   MOV 18,AX   ;guardo el primer numero en la dir 18
   LDT 'Entre otro numero'
   CMP 18      ;Comparo el contenido de AX con al dir 18 (los flags de control se modifican de acuerdo al resultado)
   JMA A       ;Salto la ejecucion a la dir A en caso de que el numero en AX haya sido mayor (esta decision se toma leyendo los flags de control)
   JEQ C       ;Salto la ejecucion a la dir C en caso de que el numero en AX haya sido igual con el que se comparó (esta decision se toma leyendo los flags de control)
   ;si llega hasta aca, es porque ni el segundo numero era mayor que el primero o igual
   MSG 'El primer numero fue Mayor'
   JMP D       ;Realizo salto incondicional, voy a la dir D a preguntar si desea volver a empezar
   ;aca viene cuando el segundo numero es el mayor
   ;Nota: puedes ir enviando el programa al Editor 1 (tipo mem) para saber a que dir corresponden tus saltos.
   MSG 'El segundo numero fue Mayor'
   JMP D
   ;aca viene cuando ambos numeros sean iguales
   MSG 'Los numeros son iguales'
   ;aca no hay necesidad de hacer salto incondicional, el programa sigue su flujo
   ;Aqui vengo a preguntar si se desea volver a empezar
   MSG 'Desea volver a empezar?'
   LDT 'Escriba  1: para SI ó 2: para NO'
   CMP 19   ;comparo con el numero 2 que esta en la pos 19
   JME 2    ;Si es menor es porque escribio 1, entonces saltaré al ppio del programa
   JEQ 14   ;Si es igual a 2, entonces voy y Termino el Programa
   MSG 'Opcion no valida' ;Si puso otra opcion
   JMP E    ;Vuelvo a preguntar
   HLT      ;Fin del Programa
 ;Aca inicializo el numero 2 para comparar en la pregunta final
#19
10  ;El numero 2
