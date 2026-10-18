import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import {
	catalogue,
	checkEntry,
	reportChecks,
	valuesAt,
} from "../standard/conformance/shared/checks.mjs";
import { unitContext } from "../standard/conformance/unit/fixtures";

function context() {
	const source = unitContext();
	const samples = source.samples.filter(
		(sample) => !sample.name.includes("build-number"),
	);
	return { ...source, samples, repeated: samples.slice(0, 2) };
}

describe("Playwright fixture and capability regressions", () => {
	it("does not hide emitted properties behind unsupported declarations", () => {
		const value = context();
		const manifest = JSON.parse(
			readFileSync(
				new URL("../standard/conformance/playwright.json", import.meta.url),
				"utf8",
			),
		);
		for (const [path, capability] of Object.entries(manifest.properties) as [
			string,
			{ supported: boolean },
		][]) {
			if (!capability.supported)
				assert.equal(
					value.samples.flatMap((sample) => valuesAt(sample.report, path))
						.length,
					0,
					`${path} is emitted but declared unsupported`,
				);
		}
	});
	it("accepts the valid control", () => {
		const value = context();
		for (const entry of catalogue.entries) {
			if (
				entry.kind === "property" &&
				entry.path === "results.environment.buildNumber"
			)
				checkEntry(entry, value);
		}
		reportChecks["single-json-object"](value);
	});
});
