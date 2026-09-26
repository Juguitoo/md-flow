import assert from "node:assert/strict";
import test from "node:test";
import { appendArchiveRow, parseArchiveTasks } from "./archive.ts";
import type { VersionEntry } from "./types.ts";

const VERSION: VersionEntry = {
  id: "v1.2.0",
  title: "Estabilización",
  status: "published",
  archive: "docs/archive/v1.2.0.md",
};

const SAMPLE = `# Archive

## Features / tareas

| ID | Tarea | Tipo | Commits | Comentario / resolución |
|----|-------|------|---------|-------------------------|
| TAR-25 | Cálculo de velocidad | Feat | | JS bridge |

## Issues resueltos

| ID | Título | Sev. | Commit | Comentario |
|----|--------|------|--------|------------|
| DATA-001 | REPLACE rompe FK | Crítico | \`3b6823c\` | Separar insert y update |

## Otra tabla

| Versión | Archivo |
|---------|---------|
| v1.0.0 | archive/v1.0.0.md |
`;

test("lee las tareas cerradas y se salta las tablas sin id", () => {
  const tasks = parseArchiveTasks(SAMPLE, VERSION);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]?.id, "TAR-25");
  assert.equal(tasks[0]?.taskType, "Feat");
  assert.equal(tasks[0]?.commits, "");
  assert.equal(tasks[0]?.note, "JS bridge");
  assert.equal(tasks[1]?.id, "DATA-001");
  assert.equal(tasks[1]?.commits, "3b6823c");
  assert.match(tasks[1]?.note ?? "", /Separar insert y update/);
  assert.match(tasks[1]?.note ?? "", /Crítico/);
  assert.equal(tasks[1]?.version, "v1.2.0");
});

test("añade la fila en la columna de commits, no en el comentario", () => {
  const next = appendArchiveRow(SAMPLE, {
    id: "UX-026",
    title: "Comentario",
    taskType: "Fix",
    commits: "ca39572",
    note: "ya no se pierde",
  });
  const tasks = parseArchiveTasks(next, VERSION);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[1]?.id, "UX-026");
  assert.equal(tasks[1]?.commits, "ca39572");
  assert.equal(tasks[1]?.note, "ya no se pierde");
  assert.equal(tasks[2]?.id, "DATA-001");
});
