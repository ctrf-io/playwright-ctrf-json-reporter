import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
let failed = false;
for (const command of [
	"test:standard:conformance:unit",
	"test:standard:conformance:integration",
]) {
	const result = spawnSync(npm, ["run", command], { stdio: "inherit" });
	if (result.error || result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
