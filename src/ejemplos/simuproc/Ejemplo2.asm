#SimuProc 1.4.3.0
 ;Ejemplo 2:
 ;Cómo inicializar variables desde el código
   MSG 'Programa Ejemplo 2'  ;Muestro el mensaje en Pantalla
   MOV AX,D   ;Llevo el contenido de la direccion D al registro AX
   EAP 'El numero almacenado en D es:'   ;Escribo el mensaje y el Valor de AX en pantalla
   ADD E      ;le sumo al Contenido de AX el valor de la dir E, el resultado queda en AX
   EAP 'La suma de estos dos numeros es:' ;Muestro en pantalla el mensaje, y el valor de AX
   HLT        ;Termina el Programa
 ;A continuacion inicializare estas variables a partir de la Pos D
#D
1101  ; Es el numero 13, los numeros se escriben en binario
10101 ; Es el numero 21 y esta inicializado en la dir E, no hay necesidad de especificarlo, pues esta consecutivo a D
