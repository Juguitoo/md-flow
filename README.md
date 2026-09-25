# Bitácora

Tablero local para ver varios proyectos y las tareas que ya escribes en markdown (`BACKLOG.md`, `ROADMAP.md`, `KNOWN_ISSUES.md` y parecidos). No está atado a un repo concreto: apuntas a una carpeta y la lee.

Sirve para el flujo de juguitoReader y para cualquier otro proyecto que lleve las tareas en archivos.

## ¿Se actualiza solo?

Sí, mientras Bitácora esté en marcha **en el mismo ordenador** donde editas. Vigila la carpeta. Cuando guardas el backlog, el tablero vuelve a leerlo y mueve las tarjetas. No hay que recargar.

Al revés también: marcar una tarea en la web cambia el checkbox de esa línea, y crear una tarea la escribe en `BACKLOG.md`.

Un cambio en otro equipo no se ve hasta que el archivo llega a este disco. Un `git pull` sí lo dispara, porque el markdown cambia aquí.

## ¿Se puede conectar a GitHub?

Sí, como fuente aparte. En cada proyecto puedes poner `owner/repositorio` y Bitácora enseña las issues abiertas en su propia columna.

- Un repo público funciona sin token.
- Un repo privado, o más refrescos, necesitan un token con lectura de issues. Se guarda en `data/github-token` y ese archivo no se sube a git. También vale la variable `GITHUB_TOKEN`.

Bitácora no hace commit ni convierte el backlog en issues. El markdown y GitHub se miran juntos, pero subir el backlog sigue siendo un commit tuyo.

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:47231](http://127.0.0.1:47231).

La primera vez carga dos proyectos de ejemplo en `examples/`. Para el tuyo: **Añadir proyecto** y la ruta de la carpeta, por ejemplo `/home/hugo/juguitoReader`.

## Qué archivos lee

En la raíz y en `docs/`:

- `BACKLOG.md` y `TASKS.md` / `TODO.md` → pendientes, salvo que el encabezado diga otra cosa
- `ROADMAP.md` → roadmap
- `KNOWN_ISSUES.md` / `ISSUES.md` → problemas

Los encabezados `Pendiente`, `En curso` y `Hecho` (también `Roadmap` y `Problemas`) colocan las tareas. Un `[x]` la da por cerrada. Una línea `prioridad: alta` y `area: data` salen en la tarjeta.

Ejemplo:

```markdown
## En curso

- [ ] DATA-014 Separar la sync de referencias
  - prioridad: alta
  - area: data

## Pendiente

- [ ] UI-010 Pantalla de ajustes

## Hecho

- [x] DATA-001 Separar insert y update
```

Si los archivos tienen otro nombre, un `bitacora.json` en la raíz puede listarlos:

```json
{
  "files": [".artifacts/plans/DATA-002.md"],
  "github": "tu-usuario/juguitoReader"
}
```

## Tests

```bash
npm test
```

Cubre el lector de markdown: secciones, ids, prioridades y escribir o marcar una tarea sin romper el resto del archivo.

## Aviso

Es un servidor local con acceso a las carpetas que registres. No lo expongas a internet.
