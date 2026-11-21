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
		specVersion: "0.3.0",
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

const sourceA = "abcdefab-e29b-41d4-a716-446655440001";
const sourceB = "abcdefab-e29b-41d4-a716-446655440002";
const derived = "abcdefab-e29b-41d4-a716-446655440003";
const syncBytes = (sample) => {
	sample.bytes = Buffer.from(JSON.stringify(sample.report));
};

test("checker/0.3.0/optional-fields-accept-omission-and-valid-emission", () => {
	const c = control();
	checkEntry(rule("single-json-object"), c);
	checkEntry(rule("declares-supported-contract"), c);
	const { report } = c.samples[0];
	const [result] = report.results.tests;
	result.description = "";
	result.threadId = "host-b/worker-2";
	result.retryAttempts[0].threadId = "host-a/worker-1";
	result.retryAttempts[0].assertionFailures = [{ expected: "", extra: {} }];
	report.results.errors = [{ extra: {} }];
	report.provenance = { inputs: [{ reportId: sourceA, extra: {} }], extra: {} };
	syncBytes(c.samples[0]);
	checkEntry(rule("single-json-object"), c);
	for (const path of [
		"results.tests[].description",
		"results.tests[].retryAttempts[].threadId",
		"results.tests[].retryAttempts[].assertionFailures[].expected",
		"results.errors[].extra",
		"provenance.inputs[].reportId",
	])
		checkEntry(property(path), c);
});

for (const [name, mutate] of [
	[
		"description",
		(r) => {
			r.results.tests[0].description = null;
		},
	],
	[
		"retry-thread",
		(r) => {
			r.results.tests[0].retryAttempts[0].threadId = 1;
		},
	],
	[
		"empty-assertions",
		(r) => {
			r.results.tests[0].assertionFailures = [];
		},
	],
	[
		"unformatted-comparison",
		(r) => {
			r.results.tests[0].retryAttempts[0].assertionFailures = [
				{ actual: { unformatted: true } },
			];
		},
	],
	[
		"empty-global-error",
		(r) => {
			r.results.errors = [{}];
		},
	],
	[
		"missing-provenance-inputs",
		(r) => {
			r.provenance = { extra: {} };
		},
	],
	[
		"bad-source-uuid",
		(r) => {
			r.provenance = { inputs: [{ reportId: "not-a-uuid" }] };
		},
	],
]) {
	test(`checker/0.3.0/rejects-${name}-even-without-capability`, () => {
		const c = control();
		mutate(c.samples[0].report);
		syncBytes(c.samples[0]);
		assert.throws(() => checkEntry(rule("single-json-object"), c));
	});
}

test("checker/0.3.0/duplicate-identity-ignores-case-and-input-metadata", () => {
	const c = control();
	c.samples[0].report.provenance = {
		inputs: [
			{ reportId: sourceA },
			{ reportId: sourceA.toUpperCase(), extra: { shard: 2 } },
		],
	};
	syncBytes(c.samples[0]);
	assert.throws(
		() => checkEntry(rule("single-json-object"), c),
		/duplicate provenance reportId/,
	);
});

test("checker/0.3.0/no-self-reference-even-with-different-case", () => {
	const c = control();
	c.samples[0].report.reportId = sourceA;
	c.samples[0].report.provenance = {
		inputs: [{ reportId: sourceA.toUpperCase() }],
	};
	syncBytes(c.samples[0]);
	assert.throws(
		() => checkEntry(rule("single-json-object"), c),
		/references its own/,
	);
});

test("checker/0.3.0/direct-lineage-excludes-flattened-ancestors-and-omits-unidentified-sources", () => {
	const c = control();
	const [sample] = c.samples;
	sample.report.reportId = derived;
	sample.directSources = [
		{ reportId: sourceA, provenance: { inputs: [{ reportId: "ancestor" }] } },
		{ reportId: sourceB },
	];
	sample.report.provenance = {
		inputs: [{ reportId: sourceB }, { reportId: sourceA.toUpperCase() }],
	};
	const unidentified = control().samples[0];
	unidentified.directSources = [{ reportId: sourceA }, {}];
	c.samples.push(unidentified);
	const check = () => checkEntry(rule("provenance-records-direct-sources"), c);
	check();
	delete sample.report.reportId;
	check();
	assert.match(c.warnings.at(-1), /SHOULD/);
	sample.report.provenance.inputs[0] = { reportId: "ancestor" };
	assert.throws(check, /all and only direct/);
	sample.report.provenance.inputs[0] = { reportId: sourceB };
	unidentified.report.provenance = { inputs: [{ reportId: sourceA }] };
	assert.throws(check, /omit lineage/);
});

test("checker/0.3.0/assertion-and-thread-mapping-uses-independent-attempt-evidence", () => {
	const c = control();
	const [sample] = c.samples;
	assert.throws(
		() => checkEntry(rule("assertion-failures-belong-to-attempt"), c),
		/Missing positive native attempt evidence/,
	);
	const [native] = sample.expected.results.tests;
	native.assertionFailures = undefined; // Earlier failure must be omitted on final pass.
	native.threadId = "host-b/worker-2";
	native.retryAttempts = [
		{
			threadId: "host-a/worker-1",
			assertionFailures: [{ message: "comparison", actual: "" }],
		},
	];
	const [output] = sample.report.results.tests;
	output.threadId = "host-b/worker-2";
	output.retryAttempts[0].threadId = "host-a/worker-1";
	output.retryAttempts[0].assertionFailures = [
		{ message: "comparison", actual: "" },
	];
	const assertionRule = rule("assertion-failures-belong-to-attempt");
	const threadRule = rule("thread-ids-belong-to-attempt");
	checkEntry(assertionRule, c);
	checkEntry(threadRule, c);
	output.retryAttempts[0].threadId = output.threadId;
	assert.throws(() => checkEntry(threadRule, c), /attempt 1/);
	output.retryAttempts[0].assertionFailures[0].expected = "inferred";
	assert.throws(() => checkEntry(assertionRule, c), /attempt 1/);
	delete output.retryAttempts[0].assertionFailures[0].expected;
	output.assertionFailures = [{ message: "comparison", actual: "" }];
	assert.throws(() => checkEntry(assertionRule, c), /assertionFailures/);
});

test("checker/0.3.0/global-errors-do-not-become-tests-even-if-counts-are-consistent", () => {
	const c = control();
	const [sample] = c.samples;
	sample.expected.results.errors = [{ message: "worker setup" }];
	sample.expected.results.tests[0].name = "case";
	sample.report.results.errors = [{ message: "worker setup" }];
	checkEntry(rule("global-errors-belong-to-run"), c);
	sample.report.results.tests.push({
		name: "worker setup",
		status: "failed",
		duration: 0,
	});
	sample.report.results.summary.tests++;
	sample.report.results.summary.failed++;
	checkEntry(rule("summary-matches-final-results"), c);
	assert.throws(
		() => checkEntry(rule("global-errors-belong-to-run"), c),
		/must not become test results/,
	);
});

test("checker/0.3.0/error-merge-multiplicity-is-advisory-but-evidence-is-required", () => {
	const c = control();
	const [sample] = c.samples;
	const check = () =>
		checkEntry(rule("global-error-merge-preserves-inputs"), c);
	assert.throws(check, /Missing merge evidence/);
	const error = { message: "setup", extra: { retryable: true } };
	sample.directSources = [
		{ results: {} },
		{ results: { errors: [error, error] } },
	];
	sample.report.results.errors = structuredClone([error, error]);
	check();
	assert.equal(c.warnings.length, 0);
	sample.report.results.errors.pop();
	check();
	assert.match(c.warnings[0], /SHOULD/);
});

test("checker/0.3.0/core-accepts-opaque-extension-values-without-extension-validation", () => {
	const c = control();
	const [sample] = c.samples;
	sample.report.extra = {
		"example/private": null,
		"ctrf.future": { extensionVersion: 42 },
	};
	sample.report.results.tests[0].extra = {
		"ctrf.future": ["opaque", false],
	};
	syncBytes(sample);
	checkEntry(rule("single-json-object"), c);
});
