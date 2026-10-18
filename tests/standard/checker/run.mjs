import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { reportPath, writeReport } from "../conformance/reporters/ctrf.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const level = "checker";
const start = Date.now();
rmSync(reportPath(level), { force: true });
try {
	const result = spawnSync(
		process.execPath,
		[
			"--test",
			"--test-reporter=spec",
			"--test-reporter-destination=stdout",
			"--test-reporter=./tests/standard/conformance/reporters/node.mjs",
			"--test-reporter-destination=stdout",
			"tests/standard/checker/checker.test.mjs",
		],
		{
			cwd: root,
			env: { ...process.env, CTRF_CONFORMANCE_LEVEL: level },
			stdio: "inherit",
			timeout: 300_000,
		},
	);
	assert.ifError(result.error);
	assert.equal(result.signal, null);
	assert.ok(
		existsSync(reportPath(level)),
		"Native runner did not emit its CTRF result",
	);
	process.exitCode = result.status;
} catch (error) {
	writeReport(
		[
			{
				name: `${level} setup`,
				status: "failed",
				message: error.message,
				trace: error.stack,
			},
		],
		level,
		"node:test",
		start,
	);
	throw error;
}
