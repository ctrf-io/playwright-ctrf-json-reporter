import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(source, "../..");
const manifest = JSON.parse(
	readFileSync(path.join(root, "package.json"), "utf8"),
);
const expectations = JSON.parse(
	readFileSync(path.join(source, "expectations.json"), "utf8"),
);
const artifacts = path.join(root, ".integration-artifacts");
rmSync(artifacts, { recursive: true, force: true });
mkdirSync(artifacts, { recursive: true });
const consumer = mkdtempSync(
	path.join(tmpdir(), "ctrf-playwright-integration-"),
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const playwrightVersion = manifest.devDependencies["@playwright/test"];
const env = {
	...process.env,
	CI: "true",
	FORCE_COLOR: "1",
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
};
delete env.NODE_PATH;
delete env.NODE_OPTIONS;
delete env.NO_COLOR;

function run(command, args, label, expectedStatus = 0, cwd = consumer) {
	const result = spawnSync(command, args, {
		cwd,
		env,
		encoding: "utf8",
		timeout: 300_000,
		maxBuffer: 10 * 1024 * 1024,
	});
	writeFileSync(
		path.join(artifacts, `${label}.log`),
		`${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error ?? ""}`,
	);
	assert.ifError(result.error);
	assert.equal(result.signal, null, `${label} terminated by ${result.signal}`);
	assert.equal(
		result.status,
		expectedStatus,
		`${label}: expected exit ${expectedStatus}, received ${result.status}; see ${artifacts}/${label}.log`,
	);
	return result.stdout;
}

try {
	console.log("Packing and installing the candidate into an isolated consumer");
	const packed = JSON.parse(
		run(
			npm,
			["pack", "--json", "--pack-destination", consumer],
			"pack",
			0,
			root,
		),
	)[0];
	assert.ok(
		packed.files.every((file) => !file.path.startsWith("tests/")),
		"Integration tooling must not be published",
	);
	writeFileSync(
		path.join(consumer, "package.json"),
		JSON.stringify({
			private: true,
			type: "module",
			dependencies: {
				"playwright-ctrf-json-reporter": `file:./${packed.filename}`,
				"@playwright/test": playwrightVersion,
				ctrf: manifest.dependencies.ctrf,
			},
		}),
	);
	run(
		npm,
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--package-lock=false",
		],
		"install",
	);
	cpSync(path.join(source, "fixtures"), consumer, { recursive: true });
	mkdirSync(path.join(consumer, "tests"));
	rmSync(path.join(consumer, "outcomes.spec.js"));
	copyFileSync(
		path.join(source, "fixtures/outcomes.spec.js"),
		path.join(consumer, "tests/outcomes.spec.js"),
	);
	copyFileSync(
		path.join(source, "validate-report.mjs"),
		path.join(consumer, "validate-report.mjs"),
	);
	copyFileSync(
		path.join(source, "expectations.json"),
		path.join(consumer, "expectations.json"),
	);
	const cli = path.join(consumer, "node_modules/@playwright/test/cli.js");
	const checkerArgs = (report, scenario) => [
		"validate-report.mjs",
		report,
		"expectations.json",
		scenario,
		playwrightVersion,
	];
	for (const scenario of expectations.scenarios) {
		console.log(`Running real Playwright scenario: ${scenario.name}`);
		writeFileSync(
			path.join(consumer, "scenario.json"),
			JSON.stringify(scenario),
		);
		run(
			process.execPath,
			[cli, "test", "--config=playwright.config.js"],
			`${scenario.name}-runner`,
			1,
		);
		const reportPath = path.join(consumer, "reports", `${scenario.name}.json`);
		copyFileSync(reportPath, path.join(artifacts, `${scenario.name}.json`));
		console.log(
			run(
				process.execPath,
				checkerArgs(reportPath, scenario.name),
				`${scenario.name}-validation`,
			).trim(),
		);
	}
	const reports = expectations.scenarios.map((scenario) =>
		JSON.parse(
			readFileSync(path.join(artifacts, `${scenario.name}.json`), "utf8"),
		),
	);
	assert.equal(
		new Set(reports.map((report) => report.reportId)).size,
		reports.length,
	);
	const nativeIds = (report) =>
		report.results.tests.map((test) => [test.name, test.testId]);
	for (const report of reports.slice(1)) {
		assert.deepEqual(
			nativeIds(report),
			nativeIds(reports[0]),
			"Native test IDs must survive repeated runs and option changes",
		);
	}

	// Both structural and schema-valid semantic regressions must fail the checker.
	const full = JSON.parse(
		readFileSync(path.join(artifacts, "full.json"), "utf8"),
	);
	const mutations = {
		"schema-invalid": (report) => {
			report.results.tests[0].status = "invalid";
		},
		"summary-mismatch": (report) => {
			report.results.summary.passed += 1;
		},
		"seconds-timestamps": (report) => {
			const test = report.results.tests[0];
			test.start = Math.floor(test.start / 1000);
			test.stop = test.start + test.duration;
		},
		"ansi-error": (report) => {
			report.results.tests.find((test) => test.name === "fails").message =
				"\u001b[31merror\u001b[0m";
		},
	};
	for (const [name, mutate] of Object.entries(mutations)) {
		const report = structuredClone(full);
		mutate(report);
		const reportPath = path.join(artifacts, `${name}.json`);
		writeFileSync(reportPath, JSON.stringify(report));
		run(
			process.execPath,
			checkerArgs(reportPath, "full"),
			`${name}-validation`,
			1,
		);
	}
	console.log(
		"Integration smoke passed: 3 real runs and 4 rejected corrupt reports",
	);
} finally {
	rmSync(consumer, { recursive: true, force: true });
	console.log(`Integration reports and logs: ${artifacts}`);
}
