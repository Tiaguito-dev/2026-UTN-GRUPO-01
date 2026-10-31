# Pendientes de implementación — validación de CA

Lo que un criterio de aceptación pide y no existe en el sistema, detectado al validar
[validacion-ca-hu.md](./validacion-ca-hu.md). Los defectos de lo que sí existe van en
[bugs-y-fixes.md](./bugs-y-fixes.md).

## HU-11 — Administración

### PEND-01 — Asociación directa de profesor a cursada (Escenario 2, ADM-04)

- **El CA pide:** "da de alta o edita una cursada (materia + año + cuatrimestre + profesor a
  cargo)" y que "la cursada queda asociada al profesor que la dictó en ese período".
- **Qué hay hoy:** el formulario de cursada solo pide año y período. El profesor se asigna a cada
  comisión con un cargo (Titular, Adjunto o JTP), y la cursada muestra la cantidad de profesores
  sumando los de sus comisiones.
- **Decisión pendiente** (ya la marcó QA el 2026-10-28 en la tarjeta):
  - **Opción A — aceptar el modelo actual:** reescribir el Escenario 2 para que diga que el profesor
    se asigna en la comisión y que la cursada lo hereda. No requiere código.
  - **Opción B — implementar el CA tal cual:** agregar "profesor a cargo" en el alta y la edición de
    cursada. Impacta en HU-04 (que muestra el profesor a cargo de la cursada), en HU-05 Escenario 2
    y en HU-06 (la reseña asociada a la cursada y al profesor que la dictó).

### PEND-02 — Verificar con un estudiante que la comisión aparece en la jerarquía (Escenario 4)

- **El CA pide:** que la comisión "queda disponible en la navegación de la jerarquía académica
  (HU-04)".
- **Qué pasó:** la cuenta admin siempre redirige a `/home/admin`, así que no se pudo ver la vista
  de estudiante. No es un faltante confirmado: falta la verificación. Hay que entrar con una cuenta
  de estudiante a Materias → "QA-PRUEBA Materia Editada" → cursada 2do cuatrimestre 2025 y
  confirmar que aparece la comisión S-997.

## HU-03 — Roles mínimos

### PEND-03 — Validar los escenarios 1 y 3 con una cuenta de estudiante

- **Qué falta:** la cuenta admin no alcanza para validar estos dos escenarios. No es un faltante de
  código confirmado: falta la verificación.
  - **E1:** registrar una cuenta nueva desde el formulario público y confirmar que queda con rol
    Usuario, sin opción para elegir el rol. En el listado de usuarios del admin, las 5 cuentas
    `@alu.frlp.utn.edu.ar` figuran como "Usuario", lo que es consistente con el escenario pero no
    lo prueba.
  - **E3:** con sesión de estudiante, entrar a `/home/admin` y confirmar que se rechaza el acceso y
    que no aparece la sección de administración. Probar también una llamada directa a un endpoint
    de administración y esperar un 403.
