import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await writeFile(
  new URL("../dist-tests/package.json", import.meta.url),
  JSON.stringify({ type: "commonjs" })
);

const result = spawnSync(
  process.execPath,
  [...(process.argv.includes("--coverage") ? ["--experimental-test-coverage"] : []), "--test", "dist-tests/tests/unit/battle/game.test.js", "dist-tests/tests/unit/battle/combat.test.js", "dist-tests/tests/unit/battle/movement.test.js", "dist-tests/tests/unit/battle/mechanics.test.js", "dist-tests/tests/unit/battle/targeting.test.js", "dist-tests/tests/unit/battle/projectiles.test.js", "dist-tests/tests/unit/battle/collision.test.js", "dist-tests/tests/unit/battle/bot.test.js", "dist-tests/tests/unit/battle/effects.test.js", "dist-tests/tests/unit/battle/health.test.js"],
  { stdio: "inherit" }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
