#SimuProc 1.4.3.0
msg multiplica
ldt ingresa un número
sta 10
ldt ingfresa otro n umero
sta 11
mul 10
push ax
lda 10
eap multiplica
lda 11
eap por
pop ax
eap igual   menos sig
mov ax,bx
eap   mas signif
hlt

