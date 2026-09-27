#SimuProc 1.4.3.0
msg suma de varios datos
ldt ciantos datosx a sumar
mov cx,ax
cla
sta 1f1
mov bx,ax
ldb f0
sta 1f0
inc bx
ldb f0
add 1f0
jo 015
sta 1f0
jnc 0f
inc 1f1
loop 08
lda 1f0
eap parte menos significativa
lda 1f1
eap parte mas significativa
hlt
msg quedó la embarrada
hlt
#f0
0100000000000000
0100000000000000
0100000000000000
0100000000000000
0100000000000000

