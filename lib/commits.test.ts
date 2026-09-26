import assert from "node:assert/strict";
import test from "node:test";
import { commitUrl, extractHashes, withCommitNote } from "./commits.ts";

test("saca hashes y los pone delante de la resolución", () => {
  assert.deepEqual(extractHashes("`CA39572` y también 202d320"), ["ca39572", "202d320"]);
  assert.equal(withCommitNote("ya no se pierde", "ca39572"), "`ca39572`. ya no se pierde");
  assert.equal(withCommitNote("`ca39572`. ya estaba", "ca39572"), "`ca39572`. ya estaba");
  assert.equal(withCommitNote("", ""), "");
  assert.equal(commitUrl("Juguitoo/JuguitoReader", "ca39572"), "https://github.com/Juguitoo/JuguitoReader/commit/ca39572");
});
