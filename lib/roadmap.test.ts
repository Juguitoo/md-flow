import assert from "node:assert/strict";
import test from "node:test";
import { addRoadmapStop, parseRoadmap, removeRoadmapStop, setRoadmapStatus, setRoadmapSummary } from "./roadmap.ts";

const SAMPLE = `# Roadmap

**Visión:** un lector local.

md-flow lee cada versión de abajo.

## v1.0.0 — Base

- estado: publicada

Primera release.

## v1.2.3 — Pulido

- estado: en curso

Pendiente UX-026.

## v1.3.0 — Biblioteca

- estado: prevista

Estadísticas.
`;

test("lee la visión y las paradas en orden", () => {
  const roadmap = parseRoadmap(SAMPLE);
  assert.equal(roadmap.vision, "un lector local.");
  assert.equal(roadmap.vision.includes("md-flow"), false);
  assert.equal(roadmap.stops.length, 3);
  assert.equal(roadmap.stops[0]?.id, "v1.0.0");
  assert.equal(roadmap.stops[0]?.status, "published");
  assert.equal(roadmap.stops[1]?.status, "doing");
  assert.equal(roadmap.stops[1]?.summary, "Pendiente UX-026.");
  assert.equal(roadmap.stops[2]?.title, "Biblioteca");
});

test("marcar publicada cambia el estado de esa parada", () => {
  const next = setRoadmapStatus(SAMPLE, "v1.2.3", "published");
  const roadmap = parseRoadmap(next);
  assert.equal(roadmap.stops.find((stop) => stop.id === "v1.2.3")?.status, "published");
  assert.equal(roadmap.stops.find((stop) => stop.id === "v1.3.0")?.status, "planned");
});

test("una parada nueva se añade al final", () => {
  const next = addRoadmapStop(SAMPLE, { id: "v1.3.2", title: "Siguiente", status: "planned" });
  const roadmap = parseRoadmap(next);
  assert.equal(roadmap.stops.at(-1)?.id, "v1.3.2");
  assert.equal(roadmap.stops.at(-1)?.status, "planned");
  assert.equal(parseRoadmap(addRoadmapStop(next, { id: "v1.3.2", title: "Siguiente", status: "doing" })).stops.find((stop) => stop.id === "v1.3.2")?.status, "doing");
});

test("el texto de una versión se sustituye y se puede quitar la parada", () => {
  const next = setRoadmapSummary(SAMPLE, "v1.2.3", "Solo el pulido.");
  const roadmap = parseRoadmap(next);
  assert.equal(roadmap.stops.find((stop) => stop.id === "v1.2.3")?.summary, "Solo el pulido.");
  assert.equal(roadmap.stops.find((stop) => stop.id === "v1.2.3")?.status, "doing");
  assert.equal(roadmap.vision, "un lector local.");
  const gone = parseRoadmap(removeRoadmapStop(next, "v1.3.0"));
  assert.equal(gone.stops.some((stop) => stop.id === "v1.3.0"), false);
  assert.equal(gone.stops.some((stop) => stop.id === "v1.2.3"), true);
});
