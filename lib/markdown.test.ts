import assert from "node:assert/strict";
import test from "node:test";
import { ensureTaskRef, insertTask, moveTask, parseMarkdown, removeTask, reorderTask, setTaskVersion, toggleCheckbox } from "./markdown.ts";

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

test("lee version, tipo y ref de las subviñetas", () => {
  const tasks = parseMarkdown(
    "## Pendiente\n- [ ] UX-026 Comentario\n  - version: v1.2.3\n  - tipo: fix\n  - ref: tasks/UX-026.md\n",
    "docs/BACKLOG.md",
  );
  assert.equal(tasks[0]?.version, "v1.2.3");
  assert.equal(tasks[0]?.taskType, "fix");
  assert.equal(tasks[0]?.ref, "tasks/UX-026.md");
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

const GROUPED = `# Backlog

## En curso

## Pendiente

### v1.2.3

- [ ] UX-026 Comentario
  - version: v1.2.3
  - tipo: fix

- [ ] TAR-56 Cajón
  - version: v1.2.3
  - tipo: feat

## Hecho

Nada cerrado.
`;

test("mover una tarea la cambia de sección y de checkbox", () => {
  const doing = moveTask(GROUPED, 9, "doing");
  assert.equal(doing.changed, true);
  const tasks = parseMarkdown(doing.content, "docs/BACKLOG.md");
  assert.equal(tasks.find((task) => task.id === "UX-026")?.status, "doing");
  assert.equal(tasks.find((task) => task.id === "TAR-56")?.status, "backlog");
  assert.match(doing.content, /## En curso\n\n- \[ \] UX-026 Comentario/);

  const done = moveTask(doing.content, parseMarkdown(doing.content, "docs/BACKLOG.md").find((task) => task.id === "UX-026")!.line!, "done");
  assert.match(done.content, /## Hecho\n\n- \[x\] UX-026 Comentario/);
  assert.equal(parseMarkdown(done.content, "docs/BACKLOG.md").find((task) => task.id === "UX-026")?.status, "done");

  const back = moveTask(done.content, parseMarkdown(done.content, "docs/BACKLOG.md").find((task) => task.id === "UX-026")!.line!, "backlog");
  const restored = parseMarkdown(back.content, "docs/BACKLOG.md").find((task) => task.id === "UX-026");
  assert.equal(restored?.status, "backlog");
  assert.equal(restored?.checked, false);
  assert.match(back.content, /### v1\.2\.3\n\n- \[ \] UX-026 Comentario/);
});

test("una ref nueva se añade al bloque de la tarea", () => {
  const linked = ensureTaskRef(GROUPED, 9, "tasks/UX-026.md");
  assert.equal(linked.changed, true);
  const task = parseMarkdown(linked.content, "docs/BACKLOG.md").find((entry) => entry.id === "UX-026");
  assert.equal(task?.ref, "tasks/UX-026.md");
  assert.equal(ensureTaskRef(linked.content, task!.line!, "tasks/UX-026.md").changed, false);
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

test("quitar una tarea se lleva el bloque y deja el resto", () => {
  const removed = removeTask(SAMPLE, 11);
  assert.equal(removed.changed, true);
  const tasks = parseMarkdown(removed.content, "BACKLOG.md");
  assert.equal(tasks.some((task) => task.id === "DATA-014"), true);
  assert.equal(tasks.some((task) => task.id === "UI-010"), false);
});

test("una tarea con versión queda bajo su grupo", () => {
  const next = insertTask(GROUPED, {
    title: "Filtro",
    ticketId: "TAR-99",
    status: "backlog",
    version: "v1.2.3",
  });
  const created = parseMarkdown(next, "docs/BACKLOG.md").find((task) => task.id === "TAR-99");
  assert.equal(created?.version, "v1.2.3");
  assert.match(next, /### v1\.2\.3\n\n- \[ \] TAR-99 Filtro\n {2}- version: v1\.2\.3/);
});

test("reordenar intercambia tareas de la misma versión", () => {
  const ux = parseMarkdown(GROUPED, "docs/BACKLOG.md").find((entry) => entry.id === "UX-026");
  const tar = parseMarkdown(GROUPED, "docs/BACKLOG.md").find((entry) => entry.id === "TAR-56");
  const next = reorderTask(GROUPED, tar?.line ?? 0, ux?.line ?? 0);
  assert.equal(next.changed, true);
  const tasks = parseMarkdown(next.content, "docs/BACKLOG.md");
  assert.deepEqual(tasks.map((entry) => entry.id), ["TAR-56", "UX-026"]);
  assert.match(next.content, /### v1\.2\.3\n\n- \[ \] TAR-56 Cajón/);
  const first = tasks[0]?.line ?? 0;
  assert.equal(reorderTask(next.content, first, first).changed, false);
});

test("reordenar no cruza de versión ni de sección", () => {
  const mixed = `${GROUPED.replace("## Hecho", `### v1.3.0

- [ ] TAR-19 Stats
  - version: v1.3.0
  - tipo: feat

## Hecho`)}`;
  const ux = parseMarkdown(mixed, "docs/BACKLOG.md").find((entry) => entry.id === "UX-026");
  const later = parseMarkdown(mixed, "docs/BACKLOG.md").find((entry) => entry.id === "TAR-19");
  const across = reorderTask(mixed, ux?.line ?? 0, later?.line ?? 0);
  assert.equal(across.changed, false);
  const doing = moveTask(mixed, ux?.line ?? 0, "doing");
  const doingLine = parseMarkdown(doing.content, "docs/BACKLOG.md").find((entry) => entry.id === "UX-026")?.line ?? 0;
  const pendingLine = parseMarkdown(doing.content, "docs/BACKLOG.md").find((entry) => entry.id === "TAR-56")?.line ?? 0;
  assert.equal(reorderTask(doing.content, doingLine, pendingLine).changed, false);
});

test("cambiar la versión mueve la tarea a su grupo", () => {
  const task = parseMarkdown(GROUPED, "docs/BACKLOG.md").find((entry) => entry.id === "UX-026");
  const next = setTaskVersion(GROUPED, task?.line ?? 0, "v1.3.0");
  const moved = parseMarkdown(next.content, "docs/BACKLOG.md").find((entry) => entry.id === "UX-026");
  const stayed = parseMarkdown(next.content, "docs/BACKLOG.md").find((entry) => entry.id === "TAR-56");
  assert.equal(moved?.version, "v1.3.0");
  assert.equal(stayed?.version, "v1.2.3");
  assert.match(next.content, /### v1\.3\.0\n\n- \[ \] UX-026/);
  assert.match(next.content, /### v1\.2\.3\n\n+- \[ \] TAR-56/);
});
