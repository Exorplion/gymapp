# La pantalla de inicio: tu cuerpo como portada

Fecha: 2026-08-04

Maqueta de referencia: el artefacto "Tu cuerpo es la pantalla de inicio",
con la comparación geométrico / anatómico y los cuatro estados.

## El problema

Hoy la app abre en "Hoy", que es una pila de tarjetas que se scrollea: hero del
día, tira semanal, volumen muscular, pre-workout, voz, carrusel. Es útil y es un
feed. No hay un momento en que mires la app y te den ganas de ir al gimnasio.

Lo que falta no es información — es una **portada**: una vista compuesta, sin
scroll, que se lea de un golpe.

## La idea

**Tu cuerpo es la portada.** Dos siluetas anatómicas, frente y espalda, con cada
grupo muscular coloreado según hace cuántos días lo entrenaste. La pantalla se
enciende cuando entrenás y se apaga sola con los días.

Entrar y ver el cuerpo apagado da ganas de prenderlo. Ese es todo el mecanismo,
y no necesita moneda, tienda ni avatar.

### Por qué anatómico y no geométrico

La primera versión usaba zonas abstractas. A 290 px de alto —que es el tamaño
real en pantalla— el argumento de "las formas simples se leen mejor en chico" no
aplica, porque no es chico.

Las formas van **reconocibles pero planas**: el abanico del pectoral, la V del
dorsal, la gota del cuádriceps, el diamante del gemelo, la herradura del
tríceps, las separaciones del recto abdominal. Relleno liso, sin sombreado ni
textura. Ni geometría cruda ni lámina de medicina: **diagrama técnico**.

### Por qué dos vistas

Con los nueve grupos de FIERRO, espalda y glúteo no existen de frente y el
tríceps casi no se ve. Una sola silueta obligaría a esconder tres grupos.

Y hay un efecto de composición: dos cuerpos simétricos con zonas marcadas es la
forma de una **lámina de anatomía**, no la de un avatar de videojuego. Es lo que
nos separa del *body graph* de Liftoff sin tener que evitar el parecido a mano.

## La silueta

### Construcción

Se dibuja **sólo la mitad izquierda** de cada cuerpo, en un `<defs>`, y la
derecha es esa misma mitad espejada con
`transform="translate(120,0) scale(-1,1)"` sobre un `<use>`.

Mitad del trazado, simetría exacta, y cambiar la forma del dorsal la cambia en
los dos lados. La cabeza y el cuello van aparte, centrados, porque no se
espejan.

`viewBox="0 0 120 250"`, alto máximo 296 px en pantalla.

### Las zonas y sus grupos

| Zona del dibujo | Vista | Grupo de FIERRO |
|---|---|---|
| Deltoides anterior / posterior | frente y espalda | Hombro |
| Pectoral | frente | Pecho |
| Bíceps | frente | Bíceps |
| Recto abdominal y oblicuo | frente | Abs |
| Cuádriceps | frente | Pierna |
| Trapecio y dorsal ancho | espalda | Espalda |
| Tríceps | espalda | Tríceps |
| Glúteo | espalda | Glúteo |
| Femoral | espalda | Pierna |
| Gemelo | frente y espalda | Gemelos |

**El trapecio pinta con Espalda.** Anatómicamente está y el dibujo se ve raro
sin él, pero FIERRO no lo tiene como grupo y `catOf` manda ahí los remos. Sumar
un décimo grupo tocaría el catálogo, la tabla de palabras clave y la tarjeta de
volumen — no lo vale por una zona del dibujo.

**Los antebrazos van neutros**, siempre, por lo mismo: no son un grupo que
rastreemos y pintarlos sería inventar un dato.

Una zona que aparece en las dos vistas (hombro, gemelo) usa el mismo color en
ambas: es el mismo grupo.

### El color

`daysSinceGroup(cat)` devuelve los días desde la última sesión que registró
series de ese grupo. Es un hecho, no un modelo — deliberadamente **no** se llama
"recuperación", que sería una afirmación fisiológica que la app no puede
sostener.

| Días | Color | Lectura |
|---|---|---|
| 0–1 | cian `#22D3EE` | recién trabajado |
| 2–3 | azul `#2E7DFF` | fresco |
| 4–6 | azul apagado `#27467F` | enfriándose |
| 7 o más | hueco con borde ámbar | está pidiendo trabajo |
| nunca entrenado | hueco neutro, sin borde | sin datos |

**"Nunca" y "hace 7+" no son lo mismo**, y por eso se ven distinto. Si un
usuario nuevo abriera la app y viera nueve zonas en ámbar, la pantalla estaría
gritando por algo que todavía no hizo mal. Un grupo sin historial se queda
neutro y callado.

### La línea de aviso

Debajo de las siluetas, **una sola línea** nombra el grupo más viejo:

> ⌁ Espalda y glúteo hace 8 días

Sólo aparece si hay al menos un grupo con 7+ días **y** con historial. Con nueve
grupos, nombrarlos todos sería una lista; nombrar el peor es un consejo.

## La pantalla completa

Todo entra en los ~660 px útiles de un teléfono de 844, sin scroll:

1. Encabezado: marca, racha, historial, ajustes *(el que ya existe)*
2. Eyebrow: `Martes 4 ago · toca hoy`
3. Nombre del día, 38 px, itálica condensada
4. Subtítulo: `9 ejercicios · 21 series · ~52 min`
5. Las dos siluetas
6. Leyenda de color, cuatro pasos
7. La línea ámbar del grupo más viejo
8. Botón grande: `EMPEZAR · 9 ej · ~52 min`
9. Línea de récord: `A 2,5 kg de tu récord en Jalón ancho`
10. Tira de la semana con ✓ en los días entrenados

### Los cuatro estados

| Situación | Qué cambia |
|---|---|
| **Toca entrenar** | Lo de arriba. |
| **Sesión abierta** | Botón: `Seguir · 3 de 9`, con el punto pulsante que ya usa el hero activo. La silueta ya incluye lo registrado hoy. |
| **Ya entrenaste** | Botón: `Ver lo que hiciste` → abre `session-view`. Eyebrow: `completado · hoy`. Debajo, en secundario, `Entrenar de nuevo`. |
| **Descanso** | Título `Descanso`. El botón pasa a secundario: `Entrenar igual` → abre el selector de día. La silueta sigue siendo el héroe. |

### Estado vacío

Sin rutina cargada, el título dice `Sin rutina` y el botón lleva a la pestaña
Rutina. Las siluetas se muestran igual, todas neutras: son la promesa de lo que
la pantalla va a ser.

## La línea de récord

`nextPR()` busca, entre los ejercicios de la rutina del día, aquel donde tu
última serie estuvo más cerca de tu máximo histórico sin superarlo, y devuelve
la diferencia.

Sale de datos que ya existen. Es más concreto que cualquier frase motivacional y
cambia solo a medida que entrenás. Si no hay ninguno cerca —o no hay historial—
la línea no aparece: **nunca se inventa una meta**.

## Navegación

**Inicio reemplaza a Hoy en la barra.** Queda `Inicio · Rutina · Comida ·
Progreso` — la barra no crece.

"Hoy" deja de ser pestaña y pasa a ser **adonde te lleva el botón grande**. Sigue
existiendo como pantalla (`S.tab = 'hoy'`), con su carrusel y su sesión; sólo
que se entra desde Inicio y se vuelve con el ‹ del encabezado.

Si hay sesión abierta, abrir la app te deja en Inicio con el botón en `Seguir` —
no te teletransporta a la sesión. Ver el estado antes de entrar es parte de lo
que hace que la pantalla valga.

## Lo que NO entra

- **Avatar.** Es identidad prestada. La silueta ya es identidad, y es verdadera.
- **Moneda, tienda, cosméticos.** Es un negocio en sí mismo con su propio balance
  que mantener, y le agrega ruido a una app que hoy es honesta.
- **Feed social.** No hay cuentas todavía. Cuando las haya, es otra decisión.
- **Ilustraciones de ejercicio.** Van en Hoy y en el editor, no acá: Inicio es tu
  cuerpo, Hoy es el trabajo.

## Riesgo asumido

**El bloque de récord y la línea ámbar compiten** por ser el motivo del día. Se
implementan los dos y se mira en el teléfono; si la pantalla se siente cargada,
el récord es el primero que sale. Queda anotado para no discutirlo dos veces.

## Archivos

- `components/screens/Inicio.jsx` (nuevo) — la pantalla
- `components/Silhouette.jsx` (nuevo) — las dos siluetas, con las zonas por grupo
- `lib/muscle.js` — `daysSinceGroup(cat)` y `stalestGroups()`
- `lib/session.js` — `nextPR(wd)`
- `components/TabBar.jsx` — Inicio en lugar de Hoy
- `components/screens/Hoy.jsx` — botón de volver a Inicio
- `lib/state.js` — `S.tab` arranca en `'inicio'`
- `styles.css` — la silueta y la composición
- Tests: `lib/__tests__/muscle.test.js` y `session.test.js`

## Publicación

Con autorización explícita, como siempre.
