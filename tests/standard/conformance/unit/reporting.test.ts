import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "vitest";
import { createReport, reportPath } from "../reporters/ctrf.mjs";
import nodeReporter from "../reporters/node.mjs";
import VitestReporter from "../reporters/vitest.mjs";

const name =
	"conformance/property/results.environment.buildNumber [expected failure: invalid-build-number]";
async function withOutput(callback: () => unknown) {
	const directory = mkdtempSync(path.join(tmpdir(), "ctrf-reporting-control-"));
	const previous = process.env.CTRF_STANDARD_ARTIFACTS;
	process.env.CTRF_STANDARD_ARTIFACTS = directory;
	try {
		await callback();
	} finally {
		if (previous === undefined) delete process.env.CTRF_STANDARD_ARTIFACTS;
		else process.env.CTRF_STANDARD_ARTIFACTS = previous;
		rmSync(directory, { recursive: true, force: true });
	}
}
it("reports expected failures as Other with defect metadata, not conformance passes", () => {
	const report = createReport(
		[
			{ name, status: "passed", duration: 0.51 },
			{ name: "normal", status: "passed" },
			{ name: "broken", status: "failed", message: "real failure" },
			{ name: "unsupported — reason", status: "skipped" },
			{ name: "not implemented", status: "pending" },
		],
		"unit",
		"vitest",
		0,
		10,
	);
	assert.deepEqual(report.results.summary, {
		tests: 5,
		start: 0,
		stop: 10,
		passed: 1,
		failed: 1,
		skipped: 1,
		pending: 1,
		other: 1,
	});
	assert.equal(report.results.tests[0].rawStatus, "expected-failure");
	assert.equal(report.results.tests[0].duration, 1);
	assert.equal(
		report.results.tests[0].extra.expectedFailure.issue,
		"invalid-build-number",
	);
	assert.equal(report.results.tests[3].name, "unit / unsupported — reason");
});
it("does not relabel unexpected passes or different failures as expected", () => {
	const report = createReport(
		[{ name, status: "failed", message: "Unexpected pass" }],
		"unit",
		"vitest",
		0,
		1,
	);
	assert.equal(report.results.tests[0].status, "failed");
	assert.equal(report.results.tests[0].message, "Unexpected pass");
	assert.equal(report.results.extra.expectedFailures, 0);
});
it("requires a matching expected-failure label and affected level", () => {
	const numeric =
		"conformance/property/results.environment.buildNumber [expected failure: invalid-build-number]";
	const report = createReport(
		[
			{ name: numeric, status: "passed" },
			{ name: name.split(" [")[0], status: "passed" },
		],
		"integration",
		"node:test",
		0,
		1,
	);
	assert.equal(report.results.summary.passed, 2);
	assert.equal(report.results.summary.other, 0);
});
it("rejects malformed runner results instead of publishing invalid CTRF", () => {
	assert.throws(() =>
		createReport([{ name: "bad", status: "unknown" }], "unit", "vitest", 0, 1),
	);
	assert.throws(() =>
		createReport(
			[{ name: "bad", status: "passed", duration: Infinity }],
			"unit",
			"vitest",
			0,
			1,
		),
	);
});
it("Node reporting retains skipped and failed cases without duplicating failed parents", async () => {
	await withOutput(async () => {
		async function* events() {
			yield {
				type: "test:pass",
				data: { name, details: { duration_ms: 0.2 } },
			};
			yield {
				type: "test:pass",
				data: {
					name: "unsupported",
					skip: "reason",
					details: { duration_ms: 0 },
				},
			};
			yield {
				type: "test:fail",
				data: {
					name: "broken",
					details: { duration_ms: 1, error: new Error("different error") },
				},
			};
			yield {
				type: "test:fail",
				data: {
					name: "parent",
					details: { error: { failureType: "subtestsFailed" } },
				},
			};
		}
		for await (const chunk of nodeReporter(events())) assert.equal(chunk, "");
		const report = JSON.parse(readFileSync(reportPath("integration"), "utf8"));
		assert.equal(report.results.summary.tests, 3);
		assert.equal(report.results.summary.other, 0);
		assert.equal(report.results.summary.passed, 1);
		assert.equal(report.results.summary.failed, 1);
		assert.equal(report.results.summary.skipped, 1);
	});
});
it("Vitest reporting includes checker cases and runner errors", async () => {
	await withOutput(() => {
		const reporter = new VitestReporter();
		reporter.onTestRunStart();
		reporter.onTestRunEnd(
			[
				{
					moduleId: "/fixture.test.ts",
					children: {
						allTests: () => [
							{
								name: "checker control",
								options: {},
								result: () => ({ state: "passed" }),
								diagnostic: () => ({ duration: 0.1 }),
							},
						],
					},
					errors: () => [{ message: "collection failed" }],
				},
			],
			[{ message: "unhandled error" }],
		);
		const report = JSON.parse(readFileSync(reportPath("unit"), "utf8"));
		assert.equal(report.results.summary.tests, 3);
		assert.equal(report.results.summary.failed, 2);
		assert.equal(report.results.tests[0].suite.at(-1), "checker-controls");
	});
});
