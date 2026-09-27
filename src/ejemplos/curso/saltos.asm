#SimuProc 1.4.2.0
ldt 'ingrese un dato'
sta 20H
ldt 'ingrese otro dato'
push ax
sub 20H
jeq 30H
jma 35H
pop ax
eap 'es menor'
lda 20H
eap  'que'
hlt

#30
pop ax
eap 'es igual'
lda 20H
eap  'con'
jmp BH
pop ax
eap 'es mayor'
lda 20H
eap   'que'
jmp BH


