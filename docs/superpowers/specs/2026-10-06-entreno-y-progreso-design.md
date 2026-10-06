# Entreno y Progreso rehechos — diseño (2026-10-06)

Aprobado por Enzo: opción **A, "el riel del ciclo"**, del lienzo privado
"FIERRO Entreno nuevo" (claude.ai/artifact/Kcz1pv3bXBbTWuJJKtKHj5; copia local
en `Documents/Enzo/FIERRO-maquetas/entreno-opciones.html`). Progreso se
diseñó en la misma sesión con el mismo criterio ("haz todo… y todas las
pantallas que te pedí").

## Entreno (`components/screens/Rutina.jsx`, `lib/entreno.js`, CSS `.ent-*`)

Problema: el plan se decía dos veces (barras 1–7 y siete tarjetas), los
descansos ocupaban tarjetas enteras, los ejercicios estaban detrás de un
acordeón por turno, y editar / Mis rutinas / Mis gimnasios ocupaban media
pantalla.

- **Cabecera**: "Tu rutina", el nombre con un lápiz (editar), dos chips
  (Cambiar rutina → hoja `library`; Gimnasio → hoja `gyms`) y la pestaña
  Plan / Ejercicios (`S.rutTab`).
- **Riel del ciclo**: cada entrenamiento es una parada con su nombre corto
  (`abreviar`), cada descanso un punto. "Hoy" marca el pendiente; si el
  pendiente es un descanso, "Sigue" marca el próximo turno (`marcaDeTurno`).
- **Un turno a la vez** (`S.rutOpen` = turno elegido; si no apunta a un
  entrenamiento, el que toca): estado ("Te toca hoy", "Hecho hace 5 días"),
  nombre, ejercicios / series / minutos, el cuerpo con las zonas que trabaja
  encendidas por series y las cinco con más series, y la lista de ejercicios
  por grupo, abierta. Se cambia con el riel, las flechas o deslizando.
- **Editar** (`S.rutMode='edit'`): la misma pantalla. Barra "Editando · se
  guarda solo · Listo", nombre de la rutina editable, "+" en el riel, nombre
  del turno editable. Tocar un ejercicio abre sus acciones (subir, bajar,
  ficha, editar, quitar); mantenerlo lo arrastra (`data-sort="rut"`, igual
  que antes). Debajo: agregar ejercicio, copiar/traer entre turnos, mover el
  turno antes/después (`moverTurno` → `applyWorkoutOrder`) y quitarlo.
- **Tu semana en series**: lo que el PLAN le da a cada zona por semana
  (llevado a 7 días si el ciclo dura otra cosa), contra la franja 10–20. La
  nota reúne lo que antes eran dos avisos: grupos por debajo de 10, porciones
  que no toca ningún ejercicio (`coberturaDe`) y lo que se está enfriando.
- **Ejercicios**: cada ejercicio una vez, por grupo, con sus turnos, su equipo,
  el último peso y el cambio contra hace 3+ semanas (`progresoDeEjercicio`;
  sin 3 semanas no se muestra tendencia). El gimnasio y "+ equipo" viven acá.
- **Mis rutinas** (`sheets/Library.jsx`): se fue la caja "La que estás
  usando". La rutina en uso va primera en "Tuyas" (aunque no esté guardada);
  "Guardar una copia" es un enlace chico.

## Progreso (`components/screens/Progreso.jsx`, `lib/progreso.js`, CSS `.prog-*`)

Problema: abría con el peso; "Tus sesiones" repetía Inicio y el historial;
Carga arrancaba en el primer ejercicio alfabético; Frecuencia repetía la
constancia; nada contestaba "¿estoy más fuerte?".

1. **Tu fuerza**: índice del 1RM estimado (Epley, mejor serie por sesión). En
   cada día entrenado de la ventana (8 semanas o desde la primera sesión), el
   promedio de último ÷ base de cada ejercicio con 2+ semanas de datos × 100.
   El número grande es el índice final − 100. Cuenta cuántos suben / siguen /
   bajan (±1 % es "igual").
2. **Ejercicio por ejercicio**: filtro Suben / Igual / Bajan; cada fila con su
   mini curva y el cambio en kg y %. Tocarla abre el gráfico y la proyección
   (`project`, acotada a 1 %/semana) o un consejo si está estable/bajando.
3. **Récords**: cuántos en 30 días (`sessionPRs`) y los últimos cuatro; "Tus
   mejores marcas" despliega la tabla completa de antes.
4. **Tu cuerpo**: promedio semanal, tendencia, registro, rango, gráfico y las
   medidas (más grasa y masa magra) en la misma tarjeta.
5. **Esta semana**: series reales por grupo (7 días) con la franja de cada
   grupo (RP: mínimo efectivo → rango que hace crecer) y el aviso de ACWR.
6. **Constancia**: racha, mejor racha, cumplimiento y el mapa en columnas por
   semana (lunes arriba).
7. **Todas tus sesiones**: una fila que abre la hoja `history`. El reloj del
   encabezado también la abre directo (antes llevaba a la lista de Progreso).

## Rendimiento

Build de producción, CPU 6×, 390×844, mediana de 7 corridas alternadas contra
lo publicado (#141): Entreno 459 → 611 ms (muestra los ejercicios y el cuerpo
abiertos en vez de tarjetas cerradas; el cuerpo es un `<path>` por zona, 40
elementos y no 200), Progreso 967 → 920 ms. Las secciones debajo del pliegue
llevan `content-visibility:auto` (sin canvas adentro).

## Pruebas

`lib/__tests__/entreno.test.js` (13) y `lib/__tests__/progreso.test.js` (9).
Verificado con Playwright headless (no la extensión: abría el Chrome de otra
computadora de Enzo) a 390 y 430 px: sin desbordes, riel, flechas, edición,
ejercicios, hoja de rutinas y el detalle de un ejercicio.
