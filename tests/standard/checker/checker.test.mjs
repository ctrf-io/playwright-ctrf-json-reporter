import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import assert, { AssertionError } from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "ctrf";
import {
	catalogue,
	checkEntry,
	reportChecks,
	disposition,
} from "../conformance/shared/checks.mjs";
import { runExpectedFailure } from "../conformance/shared/expected-failures.mjs";
const property = (path) =>
	catalogue.entries.find((entry) => entry.path === path);
const rule = (name) => catalogue.entries.find((entry) => entry.rule === name);
function control() {
	const report = {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		results: {
			tool: { name: "independent-control" },
			summary: {
				tests: 1,
				passed: 1,
				failed: 0,
				pending: 0,
				skipped: 0,
				other: 0,
				start: 100,
				stop: 120,
			},
			tests: [
				{
					name: "case",
					status: "passed",
					duration: 12,
					retries: 1,
					flaky: true,
					attemptId: "final",
					retryAttempts: [{ attempt: 1, attemptId: "first", status: "failed" }],
				},
			],
		},
	};
	return {
		samples: [
			{
				name: "valid",
				report,
				bytes: Buffer.from(JSON.stringify(report)),
				expected: {
					results: {
						summary: { tests: 1 },
						tests: [
							{
								duration: 12,
								sourceAttempts: [
									{ status: "failed" },
									{ status: "passed", duration: 12 },
								],
							},
						],
					},
				},
			},
		],
		warnings: [],
	};
}
test("checker/schema/catalogue-covers-expanded-properties-and-relationships", () => {
	const schema = getSchema(catalogue.specVersion),
		paths = [];
	function walk(input, prefix = "") {
		const node = input.$ref
			? input.$ref
					.slice(2)
					.split("/")
					.reduce((value, key) => value[key], schema)
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
		catalogue.entries.filter((e) => e.kind === "property").map((e) => e.path),
		paths,
	);
	assert.deepEqual(
		catalogue.entries
			.filter((e) => e.kind === "report")
			.map((e) => e.rule)
			.sort(),
		Object.keys(reportChecks).sort(),
	);
	assert.equal(
		new Set(catalogue.entries.map((e) => e.id)).size,
		catalogue.entries.length,
	);
});
test("checker/schema/accepts-independent-valid-document", () =>
	checkEntry(rule("single-json-object"), control()));
for (const [name, mutate] of [
	[
		"unknown-property",
		(s) => {
			s.report.unknown = true;
		},
	],
	[
		"wrong-type",
		(s) => {
			s.report.results.tests[0].duration = "12";
		},
	],
	[
		"missing-required-field",
		(s) => {
			delete s.report.results.tests[0].status;
		},
	],
])
	test(`checker/schema/rejects-${name}`, () => {
		const c = control();
		mutate(c.samples[0]);
		c.samples[0].bytes = Buffer.from(JSON.stringify(c.samples[0].report));
		assert.throws(() => checkEntry(rule("single-json-object"), c));
	});
test("checker/schema/requires-positive-evidence", () =>
	assert.throws(
		() => checkEntry(property("results.tests[].screenshot"), control()),
		/No positive evidence/,
	));
test("checker/schema/required-child-is-checked-when-parent-exists", () => {
	const c = control();
	delete c.samples[0].report.results.tests[0].status;
	assert.throws(
		() => checkEntry(property("results.tests[].status"), c),
		/missing/,
	);
});
test("checker/schema/capabilities-require-entry-and-reason", () => {
	assert.throws(() =>
		disposition(property("reportFormat"), { properties: {} }),
	);
	assert.throws(() =>
		disposition(property("reportFormat"), {
			properties: { reportFormat: { supported: true } },
		}),
	);
});
test("checker/schema/unsupported-declaration-cannot-hide-emitted-invalid-field", () => {
	const c = control();
	c.samples[0].report.results.tests[0].extra = "invalid";
	c.samples[0].bytes = Buffer.from(JSON.stringify(c.samples[0].report));
	assert.throws(() => checkEntry(rule("single-json-object"), c));
});
test("checker/specification/accepts-independent-retry-history", () => {
	for (const name of [
		"history-requires-retry-count",
		"positive-retries-require-history",
		"retry-count-matches-history-length",
		"history-orders-contiguous-attempts",
		"history-excludes-final-attempt",
		"flaky-matches-attempt-outcomes",
	])
		checkEntry(rule(name), control());
});
for (const [name, mutate] of [
	[
		"utf8-without-bom",
		(s) => {
			s.bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
		},
	],
	[
		"summary-matches-final-results",
		(s) => {
			s.report.results.summary.passed++;
		},
	],
	[
		"history-orders-contiguous-attempts",
		(s) => {
			s.report.results.tests[0].retryAttempts[0].attempt = 2;
		},
	],
	[
		"retry-count-matches-history-length",
		(s) => {
			s.report.results.tests[0].retries = 2;
		},
	],
	[
		"history-excludes-final-attempt",
		(s) => {
			s.report.results.tests[0].retryAttempts.push({
				attempt: 2,
				status: "passed",
			});
		},
	],
	[
		"flaky-matches-attempt-outcomes",
		(s) => {
			s.report.results.tests[0].flaky = false;
		},
	],
	[
		"attempt-identity-scoped-to-execution",
		(s) => {
			s.report.results.tests[0].attemptId = "first";
		},
	],
	[
		"respects-reserved-extension-ownership",
		(s) => {
			s.report.results.tests[0].extra = { "ctrf.not-owned": true };
		},
	],
])
	test(`checker/specification/rejects-${name}-mutation`, () => {
		const c = control();
		mutate(c.samples[0]);
		assert.throws(() => reportChecks[name](c));
	});
test("checker/specification/rejects-source-duration-unit-mismatch", () => {
	const c = control();
	c.samples[0].report.results.tests[0].duration *= 1000;
	assert.throws(() => checkEntry(property("results.tests[].duration"), c));
});
test("checker/specification/missing-contextual-evidence-fails", () => {
	for (const name of [
		"case-identity-stable-across-runs",
		"coordinates-run-and-shard-identity",
	])
		assert.throws(() => checkEntry(rule(name), control()), /Missing/);
});
test("checker/specification/timing-recommendation-warns", () => {
	const c = control();
	c.samples[0].report.results.summary.stop = 50;
	checkEntry(rule("orders-start-and-stop"), c);
	assert.equal(c.warnings.length, 1);
});
test("checker/specification/total-count-recommendation-warns-but-bounds-fail", () => {
	const c = control();
	c.samples[0].report.results.summary.tests = 2;
	checkEntry(property("results.summary.tests"), c);
	checkEntry(rule("summary-matches-final-results"), c);
	assert.equal(c.warnings.length, 1);
	c.samples[0].report.results.summary.tests = -1;
	assert.throws(
		() => checkEntry(property("results.summary.tests"), c),
		/nonnegative/,
	);
});
const entry = property("results.environment.buildNumber");
const issue = {
	issue: "control-defect",
	reason: "Synthetic checker control",
	followUp: "https://example.test/control",
	samples: { unit: ["first", "second"] },
};
function defectContext() {
	return {
		samples: ["first", "second"].map((name) => ({
			name,
			report: { results: { environment: { buildNumber: 1.5 } } },
		})),
	};
}
function check(_entry, context) {
	for (const sample of context.samples)
		assert.equal(
			sample.report.results.environment.buildNumber,
			0,
			"control mismatch",
		);
}
function matches(_entry, _sample, _issue, error) {
	return (
		error instanceof AssertionError &&
		error.actual === 1.5 &&
		error.expected === 0 &&
		error.operator === "strictEqual" &&
		error.message.startsWith("control mismatch\n")
	);
}
const run = (context, checker = check, level = "unit") =>
	runExpectedFailure(entry, context, level, issue, checker, matches);
test("checker/expected-failure/accepts-only-recorded-mismatch", () => {
	assert.equal(run(defectContext()).issue, "control-defect");
});
for (const [name, mutate] of [
	[
		"unexpected-pass",
		(c) => {
			for (const s of c.samples) s.report.results.environment.buildNumber = 0;
		},
	],
	[
		"partial-fix",
		(c) => {
			c.samples[1].report.results.environment.buildNumber = 0;
		},
	],
	[
		"different-value",
		(c) => {
			c.samples[0].report.results.environment.buildNumber = "wrong";
		},
	],
	[
		"missing-sample",
		(c) => {
			c.samples.pop();
		},
	],
	[
		"duplicate-sample",
		(c) => {
			c.samples.push(c.samples[0]);
		},
	],
	[
		"unrecorded-broken-sample",
		(c) => {
			c.samples.push({
				name: "third",
				report: { results: { environment: { buildNumber: 1.5 } } },
			});
		},
	],
])
	test(`checker/expected-failure/rejects-${name}`, () => {
		const c = defectContext();
		mutate(c);
		assert.throws(() => run(c));
	});
test("checker/expected-failure/rejects-infrastructure-error", () =>
	assert.throws(
		() =>
			run(defectContext(), () => {
				throw Error("infrastructure");
			}),
		/infrastructure/,
	));
test("checker/expected-failure/does-not-apply-at-unrecorded-level", () =>
	assert.throws(
		() => run(defectContext(), check, "integration"),
		/control mismatch/,
	));
test("checker/expected-failure/allows-optional-absence-outside-defect-samples", () => {
	const c = defectContext();
	c.samples.push({ name: "absent", report: { results: {} } });
	assert.equal(run(c).issue, "control-defect");
});
test("checker/expected-failure/rejects-unrelated-error-in-later-sample", () =>
	assert.throws(
		() =>
			run(defectContext(), (item, c) => {
				if (c.samples[0].name === "second") throw Error("different error");
				check(item, c);
			}),
		/different error/,
	));

test("checker/schema/shared-snapshot-matches-declared-files", () => {
	const snapshot = JSON.parse(
		readFileSync(new URL("../shared-files.json", import.meta.url)),
	);
	assert.ok(snapshot.revision);
	for (const [file, sha256] of Object.entries(snapshot.files))
		assert.equal(
			createHash("sha256")
				.update(readFileSync(new URL(`../${file}`, import.meta.url)))
				.digest("hex"),
			sha256,
			`Shared file drift: ${file}; review and synchronize the standard revision across reporters`,
		);
});
