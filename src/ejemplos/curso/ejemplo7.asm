#SimuProc 1.4.3.0
          msg resta dos cosas
          cla
          mov bx,ax
          ldt ingresa un numero
          sta 0f
          ldt otro  numero
          sub 0f
          eap resultado en ax
          jme 0C
          jo 0E
          msg no hay nega ni of
          hlt
          msg resul nega
          hlt
          msg hay oflo
          hlt
