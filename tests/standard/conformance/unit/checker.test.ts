import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { getSchema } from "ctrf";
import {
	catalogue,
	checkEntry,
	reportChecks,
	valuesAt,
} from "../shared/checks.mjs";
import { unitContext } from "./fixtures";

function context() {
	const source = unitContext();
	const samples = source.samples.filter(
		(sample) => !sample.name.includes("build-number"),
	);
	// Checker controls use a valid independent document, not the reporter's
	// known unexpected-pass mapping. Adjust the control only, never reporter tests.
	for (const sample of samples) {
		const test = sample.report.results.tests.find(
			(test: any) => test.name === "unexpected pass",
		);
		if (test?.status === "passed") {
			test.status = "failed";
			sample.report.results.summary.passed--;
			sample.report.results.summary.failed++;
			sample.bytes = Buffer.from(JSON.stringify(sample.report));
		}
	}
	return { ...source, samples, repeated: samples.slice(0, 2) };
}

describe("shared checker controls (separate from reporter conformance)", () => {
	it("does not hide emitted properties behind unsupported declarations", () => {
		const value = context();
		const manifest = JSON.parse(
			readFileSync(new URL("../playwright.json", import.meta.url), "utf8"),
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
	it("rejects actual reserved extension keys with known fixture ownership", () => {
		const value = context();
		value.samples[0].report.results.tests[0].extra = { "ctrf.not-owned": true };
		assert.throws(() =>
			reportChecks["respects-reserved-extension-ownership"](value),
		);
	});
	it("catalogue covers every expanded property and implemented relationship", () => {
		const schema = getSchema("0.2.0") as any;
		const paths: string[] = [];
		function walk(input: any, prefix = "") {
			const node = input.$ref
				? input.$ref
						.slice(2)
						.split("/")
						.reduce((value: any, key: string) => value[key], schema)
				: input;
			for (const [key, child] of Object.entries(node.properties ?? {})) {
				const path = prefix ? `${prefix}.${key}` : key;
				paths.push(path);
				walk(child, path);
			}
			if (node.items) walk(node.items, `${prefix}[]`);
		}
		walk(schema);
		assert.deepEqual(
			catalogue.entries
				.filter((entry: any) => entry.kind === "property")
				.map((entry: any) => entry.path),
			paths,
		);
		assert.equal(paths.length, 165);
		assert.equal(catalogue.entries.length, 185);
		assert.deepEqual(
			catalogue.entries
				.filter((entry: any) => entry.kind === "report")
				.map((entry: any) => entry.rule)
				.sort(),
			Object.keys(reportChecks).sort(),
		);
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
	for (const [rule, mutate] of [
		[
			"single-json-object",
			(value: any) => {
				value.samples[0].report.unknown = true;
				value.samples[0].bytes = Buffer.from(
					JSON.stringify(value.samples[0].report),
				);
			},
		],
		[
			"summary-matches-final-results",
			(value: any) => {
				value.samples[0].report.results.summary.passed++;
			},
		],
		[
			"history-orders-contiguous-attempts",
			(value: any) => {
				value.samples[0].report.results.tests.find(
					(test: any) => test.retryAttempts,
				).retryAttempts[0].attempt = 2;
			},
		],
		[
			"attempt-identity-scoped-to-execution",
			(value: any) => {
				const test = value.samples[0].report.results.tests.find(
					(test: any) => test.retryAttempts,
				);
				test.attemptId = test.retryAttempts[0].attemptId;
			},
		],
	] as const) {
		it(`rejects an independent ${rule} mutation`, () => {
			const value = context();
			mutate(value);
			assert.throws(() => reportChecks[rule](value));
		});
	}
	it("rejects wrong units despite schema-valid integers", () => {
		const value = context();
		value.samples[0].report.results.tests[0].duration *= 1000;
		const entry = catalogue.entries.find(
			(entry: any) => entry.path === "results.tests[].duration",
		);
		assert.throws(() => checkEntry(entry, value));
	});
	it("rejects missing positive evidence for supported properties", () => {
		const value = context();
		for (const sample of value.samples)
			for (const test of sample.report.results.tests) delete test.screenshot;
		assert.throws(() =>
			checkEntry(
				catalogue.entries.find(
					(entry: any) => entry.path === "results.tests[].screenshot",
				),
				value,
			),
		);
	});
});
