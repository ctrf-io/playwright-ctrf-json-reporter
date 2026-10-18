import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";
import { expectedFailures, runConformance } from "../expected-failures.mjs";
import { catalogue, disposition } from "../shared/checks.mjs";
import { unitContext } from "./fixtures";

const entry = catalogue.entries.find(
	(item: any) => item.path === "results.tests[].status",
);
function context() {
	return unitContext();
}

it("expected-failure declarations refer to supported catalogue entries and GitHub issue follow-ups", () => {
	const manifest = JSON.parse(
		readFileSync(new URL("../playwright.json", import.meta.url), "utf8"),
	);
	for (const [id, issue] of Object.entries(expectedFailures) as [
		string,
		any,
	][]) {
		const item = catalogue.entries.find((item: any) => item.id === id);
		assert.ok(item);
		assert.ok(disposition(item, manifest).supported);
		assert.ok(issue.reason);
		const followUp = new URL(issue.followUp);
		assert.equal(followUp.origin, "https://github.com");
		assert.match(
			followUp.pathname,
			/^\/ctrf-io\/playwright-ctrf-json-reporter\/issues\/\d+$/u,
		);
	}
});
it("accepts only the recorded unexpected-pass mismatch", () => {
	assert.equal(
		runConformance(entry, context(), "unit").issue,
		"unexpected-pass",
	);
});
it("rejects an unexpected pass after a known defect is fixed", () => {
	const value = context();
	for (const sample of value.samples)
		sample.report.results.tests.find(
			(test: any) => test.name === "unexpected pass",
		).status = "failed";
	assert.throws(() => runConformance(entry, value, "unit"), /Unexpected pass:/);
});
it("rejects a different source mapping failure", () => {
	const value = context();
	value.samples[0].report.results.tests[0].status = "failed";
	assert.throws(() => runConformance(entry, value, "unit"), /source mapping/);
});
it("rejects infrastructure errors rather than expecting any exception", () => {
	assert.throws(
		() =>
			runConformance(entry, context(), "unit", () => {
				throw new Error("infrastructure failed");
			}),
		/infrastructure failed/,
	);
});
it("requires every recorded failing sample, including later samples", () => {
	const value = context();
	value.samples
		.at(-1)
		.report.results.tests.find(
			(test: any) => test.name === "unexpected pass",
		).status = "failed";
	assert.throws(() => runConformance(entry, value, "unit"), /Unexpected pass:/);
});
it("rejects missing expected-failure fixtures", () => {
	const value = context();
	value.samples.pop();
	assert.throws(
		() => runConformance(entry, value, "unit"),
		/fixture missing or duplicated/,
	);
});
it("does not apply a unit-only exception at integration", () => {
	const numeric = catalogue.entries.find(
		(item: any) => item.path === "results.environment.buildNumber",
	);
	assert.throws(
		() => runConformance(numeric, context(), "integration"),
		/must be integer/,
	);
});
it("does not hide additional schema errors behind the build number defect", () => {
	const document = catalogue.entries.find(
		(item: any) => item.id === "conformance/report/single-json-object",
	);
	const value = context();
	const sample = value.samples.find(
		(sample: any) => sample.name === "nonfinite-build-number",
	);
	sample.report.unknown = true;
	sample.bytes = Buffer.from(JSON.stringify(sample.report));
	assert.throws(
		() => runConformance(document, value, "unit"),
		/additional properties/,
	);
});

it("does not accept the same defect in an unrecorded sample", () => {
	const numeric = catalogue.entries.find(
		(item: any) => item.path === "results.environment.buildNumber",
	);
	const value = context();
	value.samples[0].report.results.environment.buildNumber = 1.5;
	assert.throws(
		() => runConformance(numeric, value, "unit"),
		/must be integer/,
	);
});

it("allows required children to have no instances in an empty run", () => {
	const value = context();
	value.samples.push({
		name: "empty",
		report: { results: { tests: [] } },
		expected: { results: { tests: [] } },
	});
	assert.equal(runConformance(entry, value, "unit").issue, "unexpected-pass");
});
