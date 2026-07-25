# Diseño: Tarjeta de perfil más clara en Nutrición

**Fecha:** 2026-07-25
**Estado:** Aprobado
**Parte de:** Plan mayor de mejoras de la app (1 de 6 — ver notas al final)

## Contexto

En la vista Nutrición (`renderNutri()` en `index.html`), la tarjeta superior (`profcard`,
`data-act="profile-open"`) muestra el objetivo calórico del usuario (ej. "Mantenimiento ·
2400 kcal") y al tocarla abre el formulario de perfil (`sheetProfile()`) para editar
edad/peso/actividad/objetivo. El problema: nada en la tarjeta indica que es interactiva
ni qué pasa al tocarla — el usuario no la reconoce como el punto de entrada para ver/editar
sus datos.

## Objetivo

Hacer explícito, sin ocultar los datos actuales, que esa tarjeta es donde se ve y modifica
la información del perfil.

## Cambio

Dentro de la rama `if(m){...}` de `renderNutri()` (tarjeta con perfil ya configurado):

1. Se mantiene sin cambios el título (`${GOAL_LABEL[...]} · ${m.target} kcal`) y la línea
   de sexo/peso/rangos de macros.
2. Se agrega una tercera línea dentro de la tarjeta, estilo enlace/acción:
   **"✎ Ver / modificar mis datos"**, color `var(--blue)`.
3. El `<span class="chev">›</span>` al final de la tarjeta se reemplaza por un ícono de
   lápiz (✎) para reforzar visualmente "esto se edita".
4. Mismo `data-act="profile-open"` en el contenedor — no cambia el manejo de eventos ni
   ninguna lógica de datos.

La tarjeta de estado vacío (sin perfil configurado, "🎯 Calcular mis macros") no se toca:
ya comunica claramente su propósito.

## Fuera de alcance

- No se modifican datos, cálculos de macros, ni el formulario `sheetProfile()`.
- No se toca ninguna otra vista.

## Testing

Cambio puramente visual/HTML. Verificación manual: abrir Nutrición con perfil configurado,
confirmar que se ve la nueva línea y el ícono, y que tocar la tarjeta sigue abriendo el
formulario de perfil correctamente.

---
*Nota: este es el primer sub-proyecto de una lista de 6 mejoras acordadas con el usuario,
a implementarse una por una (spec + plan + implementación independientes):*
*1. (este doc) texto/CTA del botón de nutrición · 2. selector de ejercicios con base de
datos · 3. animaciones/pulido de UI · 4. cronómetro en vivo en "Hoy" · 5. dashboard de
insights en "Rutina" · 6. reconocimiento de voz de ejercicios.*
