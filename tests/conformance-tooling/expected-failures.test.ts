import assert from "node:assert/strict";
import { it } from "vitest";
import {
	expectedFailures,
	runConformance,
} from "../standard/conformance/expected-failures.mjs";
import { catalogue } from "../standard/conformance/shared/checks.mjs";
import { unitContext } from "../standard/conformance/unit/fixtures";

it("has no build-number expected-failure declarations", () => {
	assert.deepEqual(expectedFailures, {});
});
for (const id of [
	"conformance/property/results.environment.buildNumber",
	"conformance/report/single-json-object",
]) {
	const entry = catalogue.entries.find((item: any) => item.id === id);
	it(id + " passes with omitted invalid build numbers", () => {
		assert.equal(runConformance(entry, unitContext(), "unit"), undefined);
	});
	it(id + " rejects invalid output normally", () => {
		const value = unitContext();
		const sample = value.samples.find(
			(sample: any) => sample.name === "fractional-build-number",
		);
		sample.report.results.environment.buildNumber = 1.5;
		sample.bytes = Buffer.from(JSON.stringify(sample.report));
		assert.throws(
			() => runConformance(entry, value, "unit"),
			/must be integer/,
		);
	});
}
