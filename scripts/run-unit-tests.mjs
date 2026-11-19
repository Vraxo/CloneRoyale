import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await writeFile(
  new URL("../dist-tests/package.json", import.meta.url),
  JSON.stringify({ type: "commonjs" })
);

const result = spawnSync(
  process.execPath,
  ["--test", "dist-tests/tests/unit/game.test.js", "dist-tests/tests/unit/combat.test.js", "dist-tests/tests/unit/movement.test.js"],
  { stdio: "inherit" }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
