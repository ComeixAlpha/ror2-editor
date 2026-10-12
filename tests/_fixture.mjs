/**
 * The real profile the suite is written against, plus a `test` that knows whether it is there.
 *
 * The save is deliberately **not** committed: this repository publishes the editor, not anybody's
 * profile. Import `test` from here instead of `node:test` in any file that needs it, and every case
 * in that file is registered as skipped when the file is absent.
 *
 * That indirection is the point. The save used to be read at module scope, so without it the whole
 * file threw on import and the runner reported a failed *file* -- six files, and 110 of the 138
 * cases, gone rather than skipped. Skipping says the same thing without pretending the code is
 * broken.
 *
 * To run the full suite, put a profile at `src/__fixtures__/realsave-post-hc-v3.xml`.
 */
import { test as nodeTest } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Where a profile has to live for the fixture-backed suite to run. */
export const fixturePath = join(
  resolve(here, ".."),
  "src",
  "__fixtures__",
  "realsave-post-hc-v3.xml",
);

export const hasFixture = existsSync(fixturePath);

export const skipReason = `needs a profile at ${fixturePath} (not committed)`;

/** The profile's XML, or an empty string when it is absent. */
export const fixture = hasFixture ? readFileSync(fixturePath, "utf8") : "";

/**
 * `node:test`'s `test`, except that in a file depending on the profile every case is skipped when
 * the profile is missing. The body is never registered in that case, so nothing can touch the
 * absent save.
 */
export function test(name, ...rest) {
  if (!hasFixture) return nodeTest(name, { skip: skipReason }, () => {});
  return nodeTest(name, ...rest);
}
