import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scaffoldProject } from "./scaffold.ts";

test("la estructura se crea una vez y no pisa lo que ya hay", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bitacora-"));
  const first = await scaffoldProject(root);
  assert.deepEqual(first.sort(), [
    "docs/BACKLOG.md",
    "docs/MAINTENANCE.md",
    "docs/ROADMAP.md",
    "docs/VERSIONS.md",
    "docs/archive/v0.1.0.md",
  ]);
  const backlog = path.join(root, "docs", "BACKLOG.md");
  await fs.writeFile(backlog, "# mio\n");
  const second = await scaffoldProject(root);
  assert.deepEqual(second, []);
  assert.equal(await fs.readFile(backlog, "utf8"), "# mio\n");
  await fs.rm(root, { recursive: true, force: true });
});
