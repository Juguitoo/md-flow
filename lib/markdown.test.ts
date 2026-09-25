import assert from "node:assert/strict";
import test from "node:test";
import { insertTask, parseMarkdown, toggleCheckbox } from "./markdown.ts";

const SAMPLE = `# Backlog

Ejemplo.

## En curso
- [ ] DATA-014 Separar la sync
  - prioridad: alta
  - area: data

## Pendiente
- [ ] UI-010 Pantalla de ajustes \`media\`

## Hecho
- [x] DATA-001 Separar insert y update
`;

test("lee checkboxes, secciones, id, prioridad y área", () => {
  const tasks = parseMarkdown(SAMPLE, "BACKLOG.md");
  assert.equal(tasks.length, 3);

  assert.equal(tasks[0]?.id, "DATA-014");
  assert.equal(tasks[0]?.status, "doing");
  assert.equal(tasks[0]?.priority, "alta");
  assert.deepEqual(tasks[0]?.tags, ["data"]);
  assert.equal(tasks[0]?.line, 6);
  assert.equal(tasks[0]?.toggleable, true);

  assert.equal(tasks[1]?.id, "UI-010");
  assert.equal(tasks[1]?.status, "backlog");
  assert.equal(tasks[1]?.priority, "media");

  assert.equal(tasks[2]?.status, "done");
  assert.equal(tasks[2]?.checked, true);
});

test("un checkbox marcado dentro de En curso cuenta como hecho", () => {
  const tasks = parseMarkdown(
    "## En curso\n- [x] DATA-002 Ya está\n",
    "BACKLOG.md",
  );
  assert.equal(tasks[0]?.status, "done");
});

test("ROADMAP y KNOWN_ISSUES tienen estado por archivo", () => {
  const roadmap = parseMarkdown("- [ ] Lector EPUB\n", "ROADMAP.md");
  assert.equal(roadmap[0]?.status, "roadmap");

  const issues = parseMarkdown("- [ ] UI-003 Salta el scroll\n", "docs/KNOWN_ISSUES.md");
  assert.equal(issues[0]?.status, "issue");
  assert.equal(issues[0]?.id, "UI-003");
});

test("un encabezado con id es tarea y no se puede marcar", () => {
  const tasks = parseMarkdown(
    "## DATA-002 — Sync cross refs\nEstado: pendiente\nPrioridad: baja\n\n## Otra cosa\n",
    "BACKLOG.md",
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.id, "DATA-002");
  assert.equal(tasks[0]?.title, "Sync cross refs");
  assert.equal(tasks[0]?.status, "backlog");
  assert.equal(tasks[0]?.priority, "baja");
  assert.equal(tasks[0]?.toggleable, false);
});

test("no convierte encabezados normales en tareas", () => {
  const tasks = parseMarkdown("# Introducción\n\nTexto suelto.\n", "BACKLOG.md");
  assert.equal(tasks.length, 0);
});

test("alternar el checkbox conserva el resto de la línea", () => {
  const flipped = toggleCheckbox(SAMPLE, 6);
  assert.equal(flipped.changed, true);
  assert.match(flipped.content, /- \[x\] DATA-014 Separar la sync/);
  assert.equal(parseMarkdown(flipped.content, "BACKLOG.md")[0]?.status, "done");

  const back = toggleCheckbox(flipped.content, 6);
  assert.match(back.content, /- \[ \] DATA-014 Separar la sync/);
});

test("insertar una tarea la deja bajo la sección correcta", () => {
  const next = insertTask(SAMPLE, {
    title: "Probar el watcher",
    ticketId: "DATA-020",
    status: "backlog",
    priority: "baja",
  });
  const tasks = parseMarkdown(next, "BACKLOG.md");
  const created = tasks.find((task) => task.id === "DATA-020");
  assert.ok(created);
  assert.equal(created?.status, "backlog");
  assert.equal(created?.priority, "baja");
  assert.match(next, /## Pendiente\n- \[ \] DATA-020 Probar el watcher/);
});

test("un archivo vacío recibe una plantilla y la tarea", () => {
  const next = insertTask("", {
    title: "Primera nota",
    status: "doing",
    priority: null,
  });
  const tasks = parseMarkdown(next, "BACKLOG.md");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.status, "doing");
  assert.equal(tasks[0]?.title, "Primera nota");
});
