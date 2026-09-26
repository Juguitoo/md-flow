import assert from "node:assert/strict";
import test from "node:test";
import { addVersion, moveVersion, parseVersions, publishVersion, removeVersion } from "./versions.ts";

const SAMPLE = `# Versiones

## En curso

- v1.2.3 | Pulido de uso | archive/v1.2.3.md

## Previstas

- v1.3.0 | Biblioteca | archive/v1.3.0.md
- v1.3.1 | Tema oscuro

## Publicadas

- v1.2.2 | Sesiones | archive/v1.2.2.md
`;

test("lee la línea de versiones y resuelve el archive", () => {
  const versions = parseVersions(SAMPLE, "docs/VERSIONS.md");
  assert.equal(versions.length, 4);
  assert.equal(versions[0]?.status, "doing");
  assert.equal(versions[0]?.archive, "docs/archive/v1.2.3.md");
  assert.equal(versions[1]?.status, "planned");
  assert.equal(versions[2]?.archive, null);
  assert.equal(versions[3]?.status, "published");
});

test("cerrar una versión la mueve a publicadas", () => {
  const closed = publishVersion(SAMPLE, "v1.2.3");
  assert.equal(closed.changed, true);
  const versions = parseVersions(closed.content, "docs/VERSIONS.md");
  assert.equal(versions.find((entry) => entry.id === "v1.2.3")?.status, "published");
  assert.equal(publishVersion(closed.content, "v1.2.3").changed, false);
});

test("una versión nueva prevista no mueve la que está en curso", () => {
  const added = addVersion(SAMPLE, {
    id: "v1.2.4",
    title: "Siguiente",
    status: "planned",
    archive: "archive/v1.2.4.md",
  });
  const versions = parseVersions(added.content, "docs/VERSIONS.md");
  assert.equal(versions.find((entry) => entry.id === "v1.2.3")?.status, "doing");
  assert.equal(versions.find((entry) => entry.id === "v1.2.4")?.status, "planned");
  assert.equal(addVersion(added.content, {
    id: "v1.2.4",
    title: "Siguiente",
    status: "planned",
    archive: "archive/v1.2.4.md",
  }).changed, false);
});

test("poner una versión en curso deja la anterior como prevista", () => {
  const added = addVersion(SAMPLE, {
    id: "v1.2.4",
    title: "Siguiente",
    status: "doing",
    archive: "archive/v1.2.4.md",
  });
  const versions = parseVersions(added.content, "docs/VERSIONS.md");
  assert.equal(versions.find((entry) => entry.id === "v1.2.4")?.status, "doing");
  assert.equal(versions.find((entry) => entry.id === "v1.2.3")?.status, "planned");
});

test("mover una versión a en curso y quitarla del índice", () => {
  const doing = moveVersion(SAMPLE, "v1.3.0", "doing");
  const versions = parseVersions(doing.content, "docs/VERSIONS.md");
  assert.equal(versions.find((entry) => entry.id === "v1.3.0")?.status, "doing");
  assert.equal(versions.find((entry) => entry.id === "v1.2.3")?.status, "planned");
  const removed = removeVersion(doing.content, "v1.3.1");
  assert.equal(parseVersions(removed.content, "docs/VERSIONS.md").some((entry) => entry.id === "v1.3.1"), false);
});
