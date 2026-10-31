import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportPath, writeReport } from "../reporters/ctrf.mjs";
import { configuredOptions, expectedReport } from "../expected.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const manifest = JSON.parse(
	readFileSync(path.join(root, "package.json"), "utf8"),
);
const consumer = mkdtempSync(path.join(tmpdir(), "ctrf-standard-playwright-"));
const diagnostics = process.env.CTRF_STANDARD_ARTIFACTS;
if (diagnostics) mkdirSync(diagnostics, { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
	...process.env,
	CI: "true",
	FORCE_COLOR: "0",
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
};
delete env.NODE_PATH;
delete env.NODE_OPTIONS;
delete env.NO_COLOR;

function execute(command, args, name, expected = 0, cwd = consumer) {
	const result = spawnSync(command, args, {
		cwd,
		env,
		encoding: "utf8",
		timeout: 300_000,
		maxBuffer: 16 * 1024 * 1024,
	});
	if (diagnostics)
		writeFileSync(
			path.join(diagnostics, `${name}.log`),
			`${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error ?? ""}`,
		);
	assert.ifError(result.error);
	assert.equal(result.signal, null, `${name} terminated by signal`);
	assert.equal(
		result.status,
		expected,
		`${name}: expected exit ${expected}, got ${result.status}\n${result.stdout}\n${result.stderr}`,
	);
	return result;
}

const scenarios = [
	{ name: "full", retries: 1, expectedExit: 1, options: { buildNumber: 100 } },
	{
		name: "annotated",
		retries: 1,
		expectedExit: 1,
		options: {
			annotations: true,
			runId: "integration-run",
			shardId: "integration-shard",
			buildNumber: 0,
		},
	},
	{
		name: "minimal",
		retries: 1,
		expectedExit: 1,
		options: { minimal: true, annotations: false },
	},
	{ name: "all-passed", mode: "all-passed", expectedExit: 0 },
	{ name: "all-skipped", mode: "all-skipped", expectedExit: 0 },
	{ name: "empty-run", mode: "empty-run", expectedExit: 0 },
	{ name: "timeout-and-hooks", mode: "timeout-and-hooks", expectedExit: 1 },
	{
		name: "global-setup-error",
		group: "timeout-and-hooks",
		mode: "all-passed",
		globalSetup: true,
		expectedExit: 1,
		options: { outputDir: ".", outputFile: "global-error.json" },
	},
	{
		name: "worker-teardown-error",
		group: "timeout-and-hooks",
		mode: "worker-teardown-error",
		expectedExit: 1,
	},
	{
		name: "multiple-retries",
		mode: "multiple-retries",
		retries: 2,
		expectedExit: 1,
	},
	{
		name: "workers-and-distinct-cases",
		mode: "workers-and-distinct-cases",
		workers: 2,
		expectedExit: 0,
	},
	{
		name: "shard-one",
		group: "coordinated-shards",
		mode: "coordinated-shards",
		shard: "1/2",
		expectedExit: 0,
		options: { runId: "coordinated-run", shardId: "one" },
	},
	{
		name: "shard-two",
		group: "coordinated-shards",
		mode: "coordinated-shards",
		shard: "2/2",
		expectedExit: 0,
		options: { runId: "coordinated-run", shardId: "two" },
	},
	{
		name: "browser-evidence",
		mode: "browser-evidence",
		expectedExit: 0,
		options: { screenshot: true },
	},
	{
		name: "configured-fields",
		mode: "configured-fields",
		expectedExit: 0,
		options: {
			...configuredOptions,
			customIdentity: true,
			testType: "api",
			outputDir: "configured output",
			outputFile: "configured.json",
		},
	},
];

const conformanceStart = Date.now();
rmSync(reportPath("integration"), { force: true });
try {
	const packed = JSON.parse(
		execute(
			npm,
			["pack", "--json", "--pack-destination", consumer],
			"pack",
			0,
			root,
		).stdout,
	)[0];
	assert.ok(
		packed.files.every((file) => !file.path.startsWith("tests/")),
		"Test tooling leaked into package",
	);
	writeFileSync(
		path.join(consumer, "package.json"),
		JSON.stringify({
			private: true,
			type: "module",
			dependencies: {
				"playwright-ctrf-json-reporter": `file:./${packed.filename}`,
				"@playwright/test": manifest.devDependencies["@playwright/test"],
				ctrf: manifest.dependencies.ctrf,
			},
		}),
	);
	execute(
		npm,
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--package-lock=false",
			"--cache",
			path.join(consumer, "npm-cache"),
		],
		"install",
	);
	cpSync(path.join(here, "fixtures"), consumer, { recursive: true });
	mkdirSync(path.join(consumer, "tests"));
	copyFileSync(
		path.join(consumer, "cases.spec.js"),
		path.join(consumer, "tests/cases.spec.js"),
	);
	rmSync(path.join(consumer, "cases.spec.js"));
	copyFileSync(
		path.join(root, "tests/integration/fixtures/outcomes.spec.js"),
		path.join(consumer, "tests/outcomes.spec.js"),
	);
	const cli = path.join(consumer, "node_modules/@playwright/test/cli.js");
	const context = {
		samples: [],
		repeated: ["full", "annotated"],
		shards: ["shard-one", "shard-two"],
		producerExtensionKeys: ["errors", "annotations", "fixture.metadata"],
		warnings: [],
	};
	for (const scenario of scenarios) {
		const setting = {
			...scenario,
			fixture: scenario.mode ? "cases" : "outcomes",
			options: scenario.options ?? {},
		};
		writeFileSync(
			path.join(consumer, "scenario.json"),
			JSON.stringify(setting),
		);
		// Remove every possible output before each invocation. A previous report
		// can never satisfy this scenario's evidence requirement.
		rmSync(path.join(consumer, "reports"), { recursive: true, force: true });
		rmSync(path.join(consumer, "configured output"), {
			recursive: true,
			force: true,
		});
		rmSync(path.join(consumer, "native.json"), { force: true });
		rmSync(path.join(consumer, "global-error.json"), { force: true });
		const args = [cli, "test", "--config=playwright.config.js"];
		if (scenario.mode === "empty-run") args.push("--pass-with-no-tests");
		if (scenario.shard) args.push(`--shard=${scenario.shard}`);
		console.log(`Real Playwright: ${scenario.name}`);
		const started = Date.now();
		execute(process.execPath, args, scenario.name, scenario.expectedExit);
		const finished = Date.now();
		const reportPath = path.join(
			consumer,
			setting.options.outputDir ?? "reports",
			setting.options.outputFile ?? "report.json",
		);
		assert.ok(existsSync(reportPath), `${scenario.name}: no fresh report`);
		const bytes = readFileSync(reportPath);
		assert.ok(bytes.length > 0, `${scenario.name}: empty report`);
		const report = JSON.parse(bytes.toString("utf8"));
		const native = JSON.parse(
			readFileSync(path.join(consumer, "native.json"), "utf8"),
		);
		if (scenario.mode === "multiple-retries") {
			for (const [name, statuses, expectedCtrfStatus] of [
				[
					"unexpected pass exhausts retries",
					["passed", "passed", "passed"],
					"failed",
				],
				["expected failure after retry", ["passed", "failed"], "passed"],
				["expected failure without retry", ["failed"], "passed"],
			]) {
				const observed = native.tests.find((test) => test.name === name);
				assert.ok(observed, `Missing retry scenario: ${name}`);
				assert.deepEqual(
					observed.attempts.map((attempt) => attempt.status),
					statuses,
				);
				assert.equal(observed.expectedCtrfStatus, expectedCtrfStatus);
			}
		}
		if (scenario.mode === "workers-and-distinct-cases")
			assert.equal(native.tests.length, 4);
		if (scenario.mode === "worker-teardown-error") {
			assert.equal(native.tests.length, 2);
			assert.ok(
				native.tests.every((test) => test.expectedCtrfStatus === "passed"),
				"Worker teardown fixture tests must pass before teardown fails",
			);
			assert.match(
				report.results.tests.at(-1)?.message ?? "",
				/controlled worker teardown failure/,
			);
			assert.equal(report.results.extra?.errors?.length, 1);
		}
		if (scenario.shard)
			assert.equal(
				native.tests.length,
				1,
				"Shards must each execute exactly one distinct case",
			);
		const sample = {
			name: scenario.name,
			runWindow: [started, finished],
			report,
			base64: bytes.toString("base64"),
			expected: expectedReport(native, setting.options),
		};
		context.samples.push(sample);
		if (diagnostics)
			writeFileSync(path.join(diagnostics, `${scenario.name}.json`), bytes);
	}
	const contextPath = path.join(consumer, "context.json");
	writeFileSync(contextPath, JSON.stringify(context));
	if (diagnostics)
		writeFileSync(
			path.join(diagnostics, "context.json"),
			JSON.stringify(context),
		);
	const result = spawnSync(
		process.execPath,
		[
			"--test",
			"--test-reporter=tap",
			"--test-reporter-destination=stdout",
			`--test-reporter=${path.join(here, "../reporters/node.mjs")}`,
			"--test-reporter-destination=stdout",
			path.join(here, "conformance.test.mjs"),
		],
		{
			cwd: root,
			env: { ...env, CTRF_CONFORMANCE_CONTEXT: contextPath },
			encoding: "utf8",
			timeout: 120_000,
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	assert.ifError(result.error);
	assert.equal(result.signal, null);
	const output = result.stdout ?? "";
	const summary = Object.fromEntries(
		["tests", "pass", "fail", "cancelled", "skipped", "todo"].map((key) => [
			key,
			Number(output.match(new RegExp(`^# ${key} (\\d+)$`, "m"))?.[1] ?? -1),
		]),
	);
	assert.equal(
		summary.tests,
		185,
		`Incomplete test registration\n${output}\n${result.stderr}`,
	);
	const failures = output
		.split("\n")
		.filter((line) => line.startsWith("not ok "));
	const warnings = JSON.parse(
		output.match(/Conformance recommendations: (\[.*\])/u)?.[1] ?? "[]",
	);
	const expectedFailures = JSON.parse(
		Buffer.from(
			output.match(
				/Conformance expected failures \(base64\): ([A-Za-z0-9+/=]+)/u,
			)?.[1] ?? "W10=",
			"base64",
		).toString("utf8"),
	);
	summary.expectedFailures = expectedFailures.length;
	summary.conformancePassed = summary.pass - expectedFailures.length;
	summary.recommendationWarnings = warnings.length;
	console.log(`Standard integration: ${JSON.stringify(summary)}`);
	for (const failure of failures) console.log(failure);
	if (diagnostics) {
		writeFileSync(path.join(diagnostics, "integration.tap"), output);
		writeFileSync(
			path.join(diagnostics, "integration-summary.json"),
			JSON.stringify(
				{
					...summary,
					expectedFailureDetails: expectedFailures,
					scenarios: new Set(
						scenarios.map((scenario) => scenario.group ?? scenario.name),
					).size,
					invocations: scenarios.length,
					failures,
				},
				null,
				2,
			),
		);
	}
	process.exitCode = result.status === 0 ? 0 : 1;
} catch (error) {
	if (!existsSync(reportPath("integration")))
		writeReport(
			[
				{
					name: "Integration harness failure",
					status: "failed",
					message: error.message,
					trace: error.stack,
				},
			],
			"integration",
			"node:test",
			conformanceStart,
		);
	throw error;
} finally {
	rmSync(consumer, { recursive: true, force: true });
}
