#SimuProc 1.4.3.0
          msg suma dos cosas
          cla
          mov bx,ax
          ldt ingresa un numero
          sta 0f
          ldt otro  numero
          add 0f
          eap resultado menos sig
          mov ax,bx
          eap reslutado mas sig
          jc 0E
          jo 10
          msg no hay ni C ni OF
          hlt
          msg hay carry
          hlt
          msg hay oflo
          hlt
