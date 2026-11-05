# Arquitectura y decisiones

## Capas

```text
features/   Pantallas: día, exportar, ajustes, login
state/      Estado compartido de la bitácora
session/    Sesión: cargando, demo, autorizado o sin acceso
data/       Contrato de almacenamiento y sus implementaciones
domain/     Reglas de negocio en TypeScript puro
```

Las dependencias apuntan hacia `domain`. ESLint impide que esa capa importe React o Supabase, por
eso se prueba sin navegador ni base de datos.

## Decisiones

### Sin backend propio

El CSV se genera en el navegador y PostgreSQL aplica la seguridad con Row Level Security. Un servidor solo
agregaría costo y mantenimiento.

### Horarios calculados, no guardados

Cada día guarda el orden y la duración de sus bloques. Los horarios se derivan con `scheduleDay`, de
modo que reordenar o cambiar horas nunca deja datos inconsistentes. Las excepciones usan una hora
fija por bloque.

La regla se tomó de los datos: empezar a la hora de entrada, no partir bloques y almorzar en el
primer corte desde las 12:00. Si un bloque cruza el mediodía, el almuerzo se mueve.

### Corrección conservadora de errores

La distancia de edición permitida depende de la longitud de la palabra, y un empate no se corrige.
`pplanilla` se vuelve `Planilla`, pero `Notas` y `Zonas`, a dos ediciones, siguen siendo módulos
distintos. Preguntar cuesta menos que exportar un dato equivocado.

### Notas guardadas en cada tecla

Las notas sin agregar se escriben de forma síncrona en `localStorage`, por fecha y por cuenta. Un
guardado diferido en la base de datos podría perder lo último si el teléfono cierra la página. Al
presionar **Agregar al día** pasan a Firestore y se sincronizan.

### Teléfono primero

El uso principal es el teléfono, así que hay navegación inferior, tarjetas por actividad, formulario
como panel inferior, objetivos táctiles de 44 px y campos de 16 px, el mínimo para que iOS no haga
zoom. En escritorio, la misma información se muestra como hoja de cálculo. Los flujos de teléfono
también se prueban en WebKit, el motor de Safari.

En dispositivos táctiles el CSV se entrega con el menú de compartir, y en escritorio se descarga.

### Windows-1252 propio

El sistema de destino lee Windows-1252 y los navegadores solo codifican UTF-8 de forma nativa. Sin
conversión, `Programación` llegaría dañado, así que `domain/csv/windows1252.ts` escribe los bytes.

### Contrato de repositorio

La interfaz solo conoce `LogbookRepository`. La demo usa `localStorage` y la cuenta real usa
Supabase, sin cambios en las pantallas. Esa frontera permitió migrar de Firebase a Supabase sin
tocar las pantallas de captura ni la lógica de negocio. El SDK se carga bajo demanda, por lo que la
demo no lo ejecuta.

### Local-first sobre Supabase

Supabase no tiene modo sin conexión y el uso principal es un teléfono con señal variable. Por eso
`syncedRepository` guarda primero en el dispositivo, mantiene una bandeja de cambios por enviar y
sincroniza al recuperar la conexión o volver a abrir la app. La bandeja sobrevive al cierre de la
app y una actualización del servidor nunca deshace un cambio pendiente. Si dos dispositivos editan
el mismo día, gana el último guardado.

Se descartó Realtime: una sola persona no necesita actualizaciones en vivo, y refrescar al abrir la
app es más confiable en un teléfono.

### Un día como JSONB

Las actividades viven en una columna JSONB de `day_logs`. El día es la unidad que se edita y se
exporta, así que guardarlo es un `upsert` atómico que simplifica la sincronización. Una tabla por
actividad solo convendría si se necesitaran reportes en SQL.

### Acceso en dos niveles

Iniciar sesión solo prueba identidad. Para llegar a los datos también hay que aparecer en
`allowed_users`, una tabla sin políticas de escritura que solo se edita desde el panel. Así una
cuenta desconocida no lee nada ni escribe en la base de datos.

Las políticas se prueban aplicando la migración real sobre PostgreSQL con PGlite, sin Docker ni
servicios externos.

### Correo y contraseña

La entrada principal es con contraseña porque no depende de recibir correos y funciona igual en la
app instalada. La cuenta se crea desde el panel de Supabase, así que la app no expone registro
público. La sesión se renueva sola en cada dispositivo. El código de 6 dígitos queda como
recuperación: un enlace abriría el navegador de la app de correo, que no comparte sesión.

### `HashRouter` y base relativa

El build no depende de la ruta ni del hosting. Por eso funciona dentro de la subruta de GitHub Pages
sin configuración adicional.

## Limitaciones conocidas

- Las notas que aún no se agregan solo existen en ese navegador. Aparecen en otro dispositivo cuando
  se agregan al día.
- Si cierras sesión con cambios sin sincronizar, esa copia se conserva en el dispositivo para no
  perderlos. Úsala en dispositivos personales.
- Los cambios hechos en otro dispositivo aparecen al volver a abrir la app, no al instante.
- Cambiar la entrada o el almuerzo en Ajustes afecta los días que no tienen hora fija, y esos días
  pueden aparecer como modificados.
- El importador acepta CSV. Desde Excel, usa **Guardar como** antes de subir el historial.
