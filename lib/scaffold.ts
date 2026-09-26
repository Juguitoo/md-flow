import fs from "node:fs/promises";
import path from "node:path";

const STARTER_VERSION = "v0.1.0";
const STARTER_TITLE = "Primera versión";

export const SCAFFOLD_FILES: Record<string, string> = {
  "docs/BACKLOG.md": `# Backlog

Trabajo abierto. Al marcarlo hecho, sale de aquí y pasa al archive de su versión.

## En curso

## Pendiente

## Hecho
`,
  "docs/VERSIONS.md": `# Versiones

## En curso

- ${STARTER_VERSION} | ${STARTER_TITLE} | archive/${STARTER_VERSION}.md

## Previstas

## Publicadas
`,
  "docs/ROADMAP.md": `# Roadmap

**Visión:** Escribe aquí el objetivo del proyecto, en una línea.

## ${STARTER_VERSION} — ${STARTER_TITLE}

- estado: en curso

Resumen de esta versión. Se ve al pulsar el punto.
`,
  [`docs/archive/${STARTER_VERSION}.md`]: emptyArchive(STARTER_VERSION),
  "docs/MAINTENANCE.md": maintenanceDoc(),
};

export function emptyArchive(versionId: string): string {
  return `# Archive — ${versionId}

## Features / tareas

| ID | Tarea | Tipo | Commits | Comentario / resolución |
|----|-------|------|---------|-------------------------|

## Issues resueltos

Ninguno.
`;
}

function maintenanceDoc(): string {
  return `# Mantenimiento del formato

Bitácora lee estos markdown. Si se cambia el formato, la lista, el roadmap o el archive dejan de cuadrar. Este archivo explica qué se puede tocar y qué no.

No copies aquí detalles de un fallo que siga abierto ni nada que no deba ir a un repo público. Los planes de implementación van fuera de \`docs/\`, por ejemplo en \`.artifacts/plans/\`.

## Mapa

| Qué | Dónde |
|-----|-------|
| Trabajo abierto | [BACKLOG.md](BACKLOG.md) |
| Ficha de una tarea | [tasks/](tasks/) (\`{ID}.md\`) |
| Visión y resumen por versión | [ROADMAP.md](ROADMAP.md) |
| Qué versión está en curso, prevista o publicada, y su archive | [VERSIONS.md](VERSIONS.md) |
| Tareas ya cerradas | [archive/](archive/) (\`vX.Y.Z.md\`) |

## BACKLOG.md

Solo trabajo abierto. Tres secciones, con ese título exacto:

\`\`\`markdown
## En curso

## Pendiente

## Hecho
\`\`\`

Cada tarea es un checkbox, no una tabla:

\`\`\`markdown
### v0.1.0

- [ ] TAR-1 Título corto
  - version: v0.1.0
  - tipo: feat
  - ref: tasks/TAR-1.md
\`\`\`

- El id, si existe, va al principio de la línea: \`TAR-1\`, \`UX-026\`, \`DATA-014\`.
- \`version:\` tiene que ser un id que exista en VERSIONS.md (\`v1.2.3\`, con la v).
- \`tipo:\` es libre (\`feat\`, \`fix\`, …). \`ref:\` apunta a la ficha, relativa a la carpeta del backlog.
- Bajo \`## Pendiente\`, agrupa por \`### vX.Y.Z\`.
- \`[x]\` cuenta como hecha. Al marcarla hecha desde Bitácora, la línea sale del backlog y se añade una fila al archive de su versión. Hace falta id. Si no hay \`version:\`, usa la única versión en curso.
- No conviertas el backlog en tablas. No inventes otras secciones \`##\` para el estado.

## tasks/{ID}.md

La ficha es el relato, no la lista. El prólogo lleva \`- estado: pendiente\`, \`en curso\` o \`hecho\`. Después, estos títulos y no otros:

\`\`\`markdown
## Problema

## Decisión

## Durante el desarrollo

## Resolución
\`\`\`

Se pueden añadir otras \`##\` al final. Bitácora no las borra, pero la pantalla solo edita las cuatro de arriba. Al cerrar la tarea, si hay texto en Resolución, ese texto va a la nota del archive.

## VERSIONS.md

Tres secciones:

\`\`\`markdown
## En curso

- v0.1.0 | Primera versión | archive/v0.1.0.md

## Previstas

## Publicadas
\`\`\`

- Una línea: \`id | título | archive/vX.Y.Z.md\`. El archive es relativo a la carpeta de este archivo.
- Conviene una sola versión en curso. Si pasas otra a en curso, la anterior pasa a previstas.
- Publicar una versión mueve su línea a \`## Publicadas\` y pone el roadmap en \`estado: publicada\`. No borra las tareas abiertas de esa versión.
- No borres una versión que todavía tenga tareas en el backlog o filas en el archive.

## ROADMAP.md

La visión es una sola línea. Si el texto va en la línea de abajo, Bitácora no lo lee.

\`\`\`markdown
**Visión:** El objetivo del proyecto, en una frase.

## v0.1.0 — Primera versión

- estado: en curso

El párrafo es el resumen que se ve al pulsar el punto.
\`\`\`

- El encabezado es \`## v1.2.3 — Título\`, con raya \`—\`. No vale \`## v1.2.x\` ni \`###\`.
- \`estado:\` es \`en curso\`, \`prevista\` o \`publicada\`.
- El resto del bloque, hasta el siguiente \`## v…\`, es el resumen.

## archive/vX.Y.Z.md

Una sola forma de tabla, aunque el archivo tenga más de una sección. Los hashes van solo en Commits. El comentario no se usa para buscarlos.

\`\`\`markdown
## Features / tareas

| ID | Tarea | Tipo | Commits | Comentario / resolución |
|----|-------|------|---------|-------------------------|
| TAR-1 | Título corto | feat | \`ca39572\` \`202d320\` | Qué se hizo, en una frase. |

## Issues resueltos

| ID | Tarea | Tipo | Commits | Comentario / resolución |
|----|-------|------|---------|-------------------------|
\`\`\`

- Hace falta ID y Tarea. Sin ID, la fila no sale en Versiones.
- Commits: uno o varios hashes, separados por espacio. Nada de prosa en esa celda.
- Comentario / resolución: el texto. Si había severidad, va aquí, no en una columna aparte.
- No reescribas una fila cerrada para cambiar el pasado, salvo que el dato sea falso. No borres el archive al publicar la versión.
`;
}

export async function backlogFile(root: string): Promise<string> {
  for (const relative of ["docs/BACKLOG.md", "BACKLOG.md"]) {
    try {
      await fs.access(path.join(root, relative));
      return relative;
    } catch {
      // El siguiente candidato.
    }
  }
  return "docs/BACKLOG.md";
}

export async function scaffoldProject(root: string): Promise<string[]> {
  const created: string[] = [];
  await fs.mkdir(path.join(root, "docs", "tasks"), { recursive: true });
  await fs.mkdir(path.join(root, "docs", "archive"), { recursive: true });
  for (const [relative, content] of Object.entries(SCAFFOLD_FILES)) {
    const absolute = path.join(root, relative);
    try {
      await fs.access(absolute);
    } catch {
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, content);
      created.push(relative.replace(/\\/g, "/"));
    }
  }
  return created;
}
