import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getSchema } from "ctrf";
import { expectedFailure } from "../expected-failures.mjs";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(getSchema("0.2.0"));

export function reportPath(level) {
	return path.resolve(
		process.env.CTRF_STANDARD_ARTIFACTS ?? "ctrf",
		"reports",
		`conformance-${level}.json`,
	);
}

export function createReport(records, level, tool, start, stop = Date.now()) {
	const tests = records.map((record) => {
		assert.ok(
			Number.isFinite(record.duration ?? 0) && (record.duration ?? 0) >= 0,
			"Runner duration must be finite and nonnegative",
		);
		const id = record.name.split(" ")[0];
		const issue = expectedFailure({ id }, level);
		const observed =
			record.status === "passed" &&
			issue &&
			record.name.endsWith(`[expected failure: ${issue.issue}]`);
		return {
			name: `${level} / ${record.name}`,
			testId: `${level}:${record.name}`,
			status: observed ? "other" : record.status,
			duration: Math.round(record.duration ?? 0),
			rawStatus: observed ? "expected-failure" : record.status,
			type: level,
			suite: [
				"standard",
				"conformance",
				level,
				id.startsWith("conformance/") ? "contract" : "checker-controls",
			],
			...(record.filePath ? { filePath: record.filePath } : {}),
			...(record.message ? { message: record.message } : {}),
			...(record.trace ? { trace: record.trace } : {}),
			...(observed
				? {
						message: `Expected failure: ${issue.reason}. Follow-up: ${issue.followUp}`,
						extra: {
							expectedFailure: {
								issue: issue.issue,
								reason: issue.reason,
								followUp: issue.followUp,
							},
							runnerStatus: "passed",
						},
					}
				: {}),
		};
	});
	const summary = { tests: tests.length, start, stop };
	for (const status of ["passed", "failed", "skipped", "pending", "other"])
		summary[status] = tests.filter((test) => test.status === status).length;
	const report = {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		reportId: randomUUID(),
		timestamp: new Date(stop).toISOString(),
		generatedBy: "playwright-ctrf-conformance-tests",
		results: {
			tool: { name: tool },
			summary,
			tests,
			extra: {
				expectedFailures: tests.filter((test) => test.extra?.expectedFailure)
					.length,
			},
		},
	};
	assert.ok(validate(report), ajv.errorsText(validate.errors));
	return report;
}

export function writeReport(records, level, tool, start) {
	const output = reportPath(level);
	mkdirSync(path.dirname(output), { recursive: true });
	writeFileSync(
		output,
		JSON.stringify(createReport(records, level, tool, start), null, 2),
	);
}
