#SimuProc 1.4.2.0
LDT  "Cuantos datos"
mov cx,ax
sta 30h
mov bx,31H
LDT "ingrese dato"
stb 20H
inc bx
loop 4
lda 30h
mov cx,ax
mov bx,31H
ldb 20H
EAP "leido"
inc BX
loop B
hlt
#31
0

