#SimuProc 1.4.3.0
msg suma 10 numeros
lda c0
mov cx,ax
cla
mov bx,ax
lda f0
sta 100
inc bx
ldb f0
add 100
sta 100
loop 07
lda 100
eap resdultado
hlt
          
#C0
 1010
#f0
1010
1010
1010
1010
1010
1010
1010
1010
1010
1010
