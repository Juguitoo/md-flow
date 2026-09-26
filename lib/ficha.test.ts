import assert from "node:assert/strict";
import test from "node:test";
import { fichaCandidates, parseFicha, renderFicha, setFichaEstado } from "./ficha.ts";

const SAMPLE = `# UX-026 — Comentario

- estado: pendiente
- version: v1.2.3

Nota que no es una sección.

## Problema

Se pierde el texto.

## Durante el desarrollo

## Resolución
`;

test("lee y reescribe las secciones fijas sin perder el prólogo", () => {
  const parsed = parseFicha(SAMPLE);
  assert.match(parsed.preamble, /Nota que no es una sección/);
  assert.equal(parsed.sections.problema, "Se pierde el texto.");
  assert.equal(parsed.sections.decision, "");
  assert.equal(parsed.sections.durante, "");

  parsed.sections.resolucion = "Flush al salir.";
  const next = renderFicha(parsed.preamble, parsed.sections, parsed.extras);
  const again = parseFicha(next);
  assert.equal(again.sections.problema, "Se pierde el texto.");
  assert.equal(again.sections.resolucion, "Flush al salir.");
  assert.match(again.preamble, /Nota que no es una sección/);
  assert.match(next, /## Decisión/);
});

test("cambia el estado del prólogo", () => {
  const next = setFichaEstado(SAMPLE, "doing");
  assert.match(next, /- estado: en curso/);
  assert.match(next, /## Problema/);
});

test("la ficha de una tarea cerrada se busca junto al archive", () => {
  assert.deepEqual(fichaCandidates("docs/archive/v1.2.3.md", "UX-026"), [
    "docs/tasks/UX-026.md",
    "tasks/UX-026.md",
  ]);
  assert.deepEqual(fichaCandidates("archive/v1.0.0.md", "TAR-6"), [
    "tasks/TAR-6.md",
    "docs/tasks/TAR-6.md",
  ]);
  assert.deepEqual(fichaCandidates("docs/archive/v1.2.3.md", "—"), []);
});
