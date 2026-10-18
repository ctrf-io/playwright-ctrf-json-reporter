import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { catalogue, disposition } from "../shared/checks.mjs";
import { expectedFailure, runConformance } from "../expected-failures.mjs";
import { unitContext } from "./fixtures";

const manifest = JSON.parse(
	readFileSync(new URL("../playwright.json", import.meta.url), "utf8"),
);
const observedExpectedFailures: any[] = [];
const summary = { passed: 0, expectedFailures: 0, failed: 0, skipped: 0 };
let context: ReturnType<typeof unitContext>;
beforeAll(() => {
	context = unitContext();
});

afterAll(() => {
	summary.expectedFailures = observedExpectedFailures.length;
	console.log(`Conformance unit: ${JSON.stringify(summary)}`);
	console.log(
		`Conformance expected failures: ${JSON.stringify(observedExpectedFailures)}`,
	);
	if (process.env.CTRF_STANDARD_ARTIFACTS) {
		mkdirSync(process.env.CTRF_STANDARD_ARTIFACTS, { recursive: true });
		writeFileSync(
			`${process.env.CTRF_STANDARD_ARTIFACTS}/unit-expected-failures.json`,
			JSON.stringify(observedExpectedFailures, null, 2),
		);
		writeFileSync(
			`${process.env.CTRF_STANDARD_ARTIFACTS}/unit-summary.json`,
			JSON.stringify(summary, null, 2),
		);
	}
	if (context.warnings.length)
		console.warn(
			`Conformance recommendations: ${JSON.stringify(context.warnings)}`,
		);
});

describe("CTRF 0.2.0 standard conformance / unit", () => {
	for (const entry of catalogue.entries) {
		const capability = disposition(entry, manifest);
		if (!capability.supported) {
			summary.skipped++;
			it.skip(`${entry.id} — ${capability.reason}`, () => {});
		} else {
			const issue = expectedFailure(entry, "unit");
			it(`${entry.id}${issue ? ` [expected failure: ${issue.issue}]` : ""}`, () => {
				try {
					const result = runConformance(entry, context, "unit");
					if (result) observedExpectedFailures.push(result);
					else summary.passed++;
				} catch (error) {
					summary.failed++;
					throw error;
				}
			});
		}
	}
});
