import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual, TextDecoder } from "node:util";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getSchema } from "ctrf";

export const catalogue = JSON.parse(
	readFileSync(new URL("./catalogue.json", import.meta.url), "utf8"),
);
const schema = getSchema(catalogue.specVersion);
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validateDocument = ajv.compile(schema);
const validators = new Map();

function resolve(node) {
	if (!node.$ref) return node;
	return node.$ref
		.slice(2)
		.split("/")
		.reduce((value, key) => value[key], schema);
}

function propertySchema(path) {
	let node = schema;
	for (const part of path.split(".")) {
		const key = part.replace("[]", "");
		node = resolve(node).properties[key];
		if (part.endsWith("[]")) node = resolve(node).items;
	}
	return resolve(node);
}

// Parent/array-item shape is checked here; child properties have their own
// named checks. Full-document validation still checks every nested constraint.
function localSchema(node) {
	const value = structuredClone(resolve(node));
	if (value.properties) {
		value.properties = Object.fromEntries(
			Object.keys(value.properties).map((key) => [key, {}]),
		);
	}
	if (value.items?.properties) value.items = { type: "object" };
	return value;
}

export function valuesAt(object, path) {
	let values = [object];
	for (const part of path.split(".")) {
		const key = part.replace("[]", "");
		values = values.flatMap((parent) => {
			if (!parent || typeof parent !== "object" || !(key in parent)) return [];
			const value = parent[key];
			return part.endsWith("[]")
				? Array.isArray(value)
					? value
					: []
				: [value];
		});
	}
	return values;
}

function parentValues(report, path) {
	const parts = path.split(".");
	return {
		key: parts.pop(),
		parents: parts.length ? valuesAt(report, parts.join(".")) : [report],
	};
}

export function checkProperty(entry, context) {
	const node = propertySchema(entry.path);
	if (!validators.has(entry.path)) {
		validators.set(entry.path, ajv.compile(localSchema(node)));
	}
	const validate = validators.get(entry.path);
	let witnessed = 0;
	for (const sample of context.samples) {
		const actual = valuesAt(sample.report, entry.path);
		witnessed += actual.length;
		const { key, parents } = parentValues(sample.report, entry.path);
		if (entry.required) {
			for (const parent of parents) {
				assert.ok(
					Object.hasOwn(parent, key),
					`${sample.name}: missing ${entry.path}`,
				);
			}
		}
		for (const value of actual) {
			if (
				/^results\.summary\.(tests|passed|failed|skipped|pending|other|flaky|suites|duration)$/u.test(
					entry.path,
				) ||
				entry.path.endsWith(".duration") ||
				entry.path.endsWith(".retries")
			)
				assert.ok(
					value >= 0,
					`${sample.name}: ${entry.path} must be nonnegative`,
				);
			assert.ok(
				validate(value),
				`${sample.name}: ${entry.path}: ${ajv.errorsText(validate.errors)}`,
			);
		}
		if (
			sample.runWindow &&
			["timestamp", "results.summary.start", "results.summary.stop"].includes(
				entry.path,
			)
		) {
			for (const value of actual) {
				const milliseconds =
					entry.path === "timestamp" ? Date.parse(value) : value;
				if (milliseconds === 0 && sample.report.results.tests.length === 0)
					continue;
				assert.ok(
					milliseconds >= sample.runWindow[0] &&
						milliseconds <= sample.runWindow[1],
					`${sample.name}: ${entry.path} outside independently observed run window; check units`,
				);
			}
		}
		const expected = valuesAt(sample.expected ?? {}, entry.path);
		// Source expectations are partial for objects with generated identity.
		// Primitive values and arrays of primitives can be compared exactly.
		if (
			entry.path !== "results.summary.tests" &&
			expected.length &&
			expected.every(
				(value) =>
					value === null ||
					typeof value !== "object" ||
					(Array.isArray(value) &&
						value.every((item) => typeof item !== "object")),
			)
		) {
			assert.deepEqual(
				actual,
				expected,
				`${sample.name}: source mapping ${entry.path}`,
			);
		}
		if (entry.path.endsWith(".suite")) {
			for (const suite of actual) assert.ok(suite.length > 0);
		}
		if (entry.path.endsWith(".screenshot")) {
			for (const screenshot of actual) {
				assert.match(
					screenshot,
					/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u,
				);
				const bytes = Buffer.from(screenshot, "base64");
				assert.ok(bytes.length > 0, "Screenshot must contain image bytes");
				assert.ok(
					bytes
						.subarray(0, 8)
						.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
						bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
					"Controlled screenshot fixture must be PNG or JPEG",
				);
			}
		}
	}
	assert.ok(
		witnessed > 0,
		`No positive evidence for supported property ${entry.path}`,
	);
}

const tests = (context) =>
	context.samples.flatMap((sample) => sample.report.results.tests);
const histories = (context) =>
	tests(context).filter((test) => test.retryAttempts !== undefined);

function unique(values, description) {
	assert.equal(new Set(values).size, values.length, description);
}

function sourcePairs(sample) {
	const expected = sample.expected?.results?.tests ?? [];
	return sample.report.results.tests.map((test, index) => [
		test,
		expected[index],
	]);
}

function checkProvenanceIdentities(report, name) {
	const inputs = report.provenance?.inputs;
	if (!inputs) return;
	const ids = inputs.map(({ reportId }) => reportId.toLowerCase());
	unique(ids, `${name}: duplicate provenance reportId`);
	assert.ok(
		!ids.includes(report.reportId?.toLowerCase()),
		`${name}: provenance references its own reportId`,
	);
}

// A diagnostic is evidence only when a controlled source oracle explicitly
// records it. An own property of undefined means the output must omit it.
function matchSourceValue(actual, expected, key, label) {
	if (!Object.hasOwn(expected ?? {}, key)) return false;
	assert.deepEqual(actual[key], expected[key], label);
	if (expected[key] === undefined)
		assert.ok(!Object.hasOwn(actual, key), `${label}: expected omission`);
	return expected[key] !== undefined;
}

function checkAttemptEvidence(context, key) {
	let witnessed = false;
	for (const sample of context.samples) {
		for (const [test, expected] of sourcePairs(sample)) {
			const label = `${sample.name}: ${test.name} ${key}`;
			witnessed = matchSourceValue(test, expected, key, label) || witnessed;
			if (!expected?.retryAttempts) continue;
			for (const [index, attempt] of expected.retryAttempts.entries()) {
				if (!Object.hasOwn(attempt ?? {}, key)) continue;
				const actual = test.retryAttempts?.[index];
				assert.ok(actual, `${label}: missing history attempt ${index + 1}`);
				witnessed =
					matchSourceValue(
						actual,
						attempt,
						key,
						`${label} (attempt ${index + 1})`,
					) || witnessed;
			}
		}
	}
	assert.ok(witnessed, `Missing positive native attempt evidence for ${key}`);
}

export const reportChecks = {
	"provenance-identities-are-distinct": (context) => {
		assert.ok(
			context.samples.some(({ report }) => report.provenance),
			"Missing provenance output",
		);
		for (const { report, name } of context.samples)
			checkProvenanceIdentities(report, name);
	},
	"provenance-records-direct-sources": (context) => {
		let witnessed = false;
		for (const { report, name, directSources } of context.samples) {
			if (!directSources) continue;
			assert.ok(
				directSources.length > 0,
				`${name}: missing direct source evidence`,
			);
			const sourceIds = directSources.map(({ reportId }) =>
				reportId?.toLowerCase(),
			);
			if (sourceIds.includes(undefined)) {
				assert.ok(
					!Object.hasOwn(report, "provenance"),
					`${name}: omit lineage when a source lacks an ID`,
				);
				continue;
			}
			assert.ok(
				report.provenance,
				`${name}: missing provenance for the implemented scenario`,
			);
			checkProvenanceIdentities(report, name);
			const expected = [...new Set(sourceIds)].sort();
			const actual = report.provenance.inputs
				.map(({ reportId }) => reportId.toLowerCase())
				.sort();
			assert.deepEqual(
				actual,
				expected,
				`${name}: record all and only direct source IDs`,
			);
			if (!report.reportId) {
				context.warnings ??= [];
				context.warnings.push(
					`${name}: a derived report should have a new reportId (SHOULD, Core §20.1)`,
				);
			}
			witnessed = true;
		}
		assert.ok(witnessed, "Missing positive direct source evidence");
	},
	"assertion-failures-belong-to-attempt": (context) =>
		checkAttemptEvidence(context, "assertionFailures"),
	"thread-ids-belong-to-attempt": (context) =>
		checkAttemptEvidence(context, "threadId"),
	"global-errors-belong-to-run": (context) => {
		let witnessed = false;
		for (const { report, name, expected } of context.samples) {
			witnessed =
				matchSourceValue(
					report.results,
					expected?.results,
					"errors",
					`${name}: run error mapping`,
				) || witnessed;
			if (
				report.results.errors &&
				Object.hasOwn(expected?.results ?? {}, "errors")
			) {
				assert.ok(
					Array.isArray(expected.results.tests),
					`${name}: missing independent test case evidence`,
				);
				assert.deepEqual(
					report.results.tests.map(({ name }) => name),
					expected.results.tests.map(({ name }) => name),
					`${name}: global errors must not become test results`,
				);
			}
		}
		assert.ok(witnessed, "Missing positive native global error evidence");
	},
	"global-error-merge-preserves-inputs": (context) => {
		let witnessed = false;
		for (const { report, name, directSources } of context.samples) {
			if (!directSources || directSources.length < 2) continue;
			const expected = directSources.flatMap(
				(source) => source.results.errors ?? [],
			);
			if (!expected.length) continue;
			witnessed = true;
			// The recommendation requires preservation of entries and multiplicity.
			// There is no prescribed relative order of source reports.
			const extra = [...(report.results.errors ?? [])];
			let missing = false;
			for (const error of expected) {
				const index = extra.findIndex((candidate) =>
					isDeepStrictEqual(candidate, error),
				);
				if (index === -1) missing = true;
				else extra.splice(index, 1);
			}
			if (missing || extra.length) {
				context.warnings ??= [];
				context.warnings.push(
					`${name}: merge should retain all input errors without deduplicating (SHOULD, Core §6.5)`,
				);
			}
		}
		assert.ok(witnessed, "Missing merge evidence with input errors");
	},
	"utf8-without-bom": (context) => {
		for (const sample of context.samples) {
			assert.ok(
				!sample.bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])),
				sample.name,
			);
			new TextDecoder("utf-8", { fatal: true }).decode(sample.bytes);
		}
	},
	"single-json-object": (context) => {
		for (const sample of context.samples) {
			const report = JSON.parse(sample.bytes.toString("utf8"));
			assert.ok(report && !Array.isArray(report) && typeof report === "object");
			assert.ok(
				validateDocument(report),
				`${sample.name}: ${ajv.errorsText(validateDocument.errors)}`,
			);
			// Even unsupported optional features must obey intrinsic rules if emitted.
			checkProvenanceIdentities(report, sample.name);
		}
	},
	"declares-supported-contract": (context) => {
		for (const { report } of context.samples) {
			assert.equal(report.reportFormat, "CTRF");
			assert.equal(report.specVersion, catalogue.specVersion);
		}
	},
	"summary-matches-final-results": (context) => {
		for (const { report } of context.samples) {
			const { summary, tests: cases } = report.results;
			if (summary.tests !== cases.length) {
				context.warnings ??= [];
				context.warnings.push(
					"summary.tests differs from test array length (SHOULD, Core §8.1)",
				);
			}
			for (const status of [
				"passed",
				"failed",
				"skipped",
				"pending",
				"other",
			]) {
				assert.equal(
					summary[status],
					cases.filter((test) => test.status === status).length,
				);
				assert.ok(summary[status] >= 0);
			}
		}
	},
	"summary-matches-flaky-results": (context) => {
		let witnessed = false;
		for (const { report } of context.samples) {
			if (report.results.summary.flaky === undefined) continue;
			witnessed = true;
			assert.equal(
				report.results.summary.flaky,
				report.results.tests.filter((test) => test.flaky).length,
			);
		}
		assert.ok(witnessed, "No summary.flaky evidence");
	},
	"orders-start-and-stop": (context) => {
		for (const sample of context.samples) {
			for (const value of [
				sample.report.results.summary,
				...sample.report.results.tests,
				...sample.report.results.tests.flatMap(
					(test) => test.retryAttempts ?? [],
				),
			]) {
				if (
					value.start !== undefined &&
					value.stop !== undefined &&
					value.stop < value.start
				) {
					context.warnings?.push(
						`${sample.name}: stop precedes start (SHOULD)`,
					);
				}
			}
		}
	},
	"history-requires-retry-count": (context) => {
		assert.ok(histories(context).length, "Missing retry fixture");
		for (const test of histories(context))
			assert.ok(Number.isInteger(test.retries));
	},
	"positive-retries-require-history": (context) => {
		for (const test of tests(context))
			if (test.retries > 0) assert.ok(test.retryAttempts?.length > 0);
	},
	"zero-retries-omit-history": (context) => {
		for (const test of tests(context))
			if (test.retries === 0) assert.equal(test.retryAttempts, undefined);
	},
	"retry-count-matches-history-length": (context) => {
		for (const test of histories(context))
			assert.equal(test.retries, test.retryAttempts.length);
	},
	"history-orders-contiguous-attempts": (context) => {
		for (const test of histories(context))
			assert.deepEqual(
				test.retryAttempts.map((attempt) => attempt.attempt),
				Array.from({ length: test.retries }, (_, index) => index + 1),
			);
	},
	"history-excludes-final-attempt": (context) => {
		let witnessed = false;
		for (const sample of context.samples) {
			for (const [actual, source] of sourcePairs(sample)) {
				if (!actual.retryAttempts || !source?.sourceAttempts) continue;
				witnessed = true;
				assert.equal(
					actual.retryAttempts.length,
					source.sourceAttempts.length - 1,
				);
				assert.deepEqual(
					actual.retryAttempts.map((attempt) => [
						attempt.status,
						attempt.duration,
					]),
					source.sourceAttempts
						.slice(0, -1)
						.map((attempt) => [attempt.status, attempt.duration]),
				);
				assert.equal(actual.duration, source.sourceAttempts.at(-1).duration);
			}
		}
		assert.ok(witnessed, "Missing independent attempt evidence");
	},
	"flaky-matches-attempt-outcomes": (context) => {
		for (const sample of context.samples) {
			for (const [actual, source] of sourcePairs(sample)) {
				if (actual.flaky === undefined) continue;
				const earlier =
					source?.sourceAttempts?.slice(0, -1) ?? actual.retryAttempts ?? [];
				assert.equal(
					actual.flaky,
					actual.status === "passed" &&
						earlier.some((attempt) => attempt.status === "failed"),
				);
			}
		}
	},
	"case-identity-stable-across-runs": (context) => {
		assert.ok(
			context.repeated?.length >= 2,
			"Missing independent repeated runs",
		);
		const expected = context.repeated[0].report.results.tests.map((test) => [
			test.name,
			test.testId,
		]);
		for (const sample of context.repeated.slice(1))
			assert.deepEqual(
				sample.report.results.tests.map((test) => [test.name, test.testId]),
				expected,
			);
	},
	"execution-identity-distinguishes-executions": (context) => {
		const ids = tests(context)
			.map((test) => test.executionId)
			.filter((id) => id !== undefined);
		assert.ok(ids.length);
		unique(ids, "Execution IDs reused across independent emitted results");
	},
	"attempt-identity-scoped-to-execution": (context) => {
		for (const test of tests(context))
			unique(
				[
					test.attemptId,
					...(test.retryAttempts ?? []).map((attempt) => attempt.attemptId),
				].filter((id) => id !== undefined),
				"Attempt ID reused within execution",
			);
	},
	"attachment-identity-scoped-to-parent": (context) => {
		for (const test of tests(context))
			for (const parent of [test, ...(test.retryAttempts ?? [])])
				unique(
					(parent.attachments ?? [])
						.map((attachment) => attachment.attachmentId)
						.filter((id) => id !== undefined),
					"Attachment ID reused within parent",
				);
	},
	"document-identity-follows-emission": (context) => {
		unique(
			context.samples
				.map((sample) => sample.report.reportId)
				.filter((id) => id !== undefined),
			"Independent emissions reused report identity",
		);
	},
	"coordinates-run-and-shard-identity": (context) => {
		assert.ok(
			context.shards?.length >= 2,
			"Missing coordinated shard evidence",
		);
		const [first] = context.shards;
		for (const sample of context.shards)
			assert.equal(sample.report.runId, first.report.runId);
		unique(
			context.shards.map((sample) => sample.report.results.environment.shardId),
			"Shard labels are not distinct",
		);
	},
	"respects-reserved-extension-ownership": (context) => {
		// These controlled fixtures declare which reserved extensions, if any,
		// are CTRF-owned. Check actual output keys, not a list of expected keys.
		for (const entry of catalogue.entries.filter(
			(item) =>
				item.kind === "property" &&
				(item.path === "extra" || item.path.endsWith(".extra")),
		)) {
			for (const sample of context.samples) {
				for (const extra of valuesAt(sample.report, entry.path)) {
					for (const key of Object.keys(extra)) {
						if (!key.startsWith("ctrf.") && !key.startsWith("ctrf/")) continue;
						assert.ok(
							context.ctrfDefinedExtensions?.includes(key),
							`${sample.name}: fixture producer claimed reserved extension ${key}`,
						);
					}
				}
			}
		}
	},
};

const recommendedRules = new Set([
	"orders-start-and-stop",
	"case-identity-stable-across-runs",
	"execution-identity-distinguishes-executions",
	"attempt-identity-scoped-to-execution",
	"attachment-identity-scoped-to-parent",
	"document-identity-follows-emission",
	"coordinates-run-and-shard-identity",
]);

export function checkEntry(entry, context) {
	if (entry.kind === "property") checkProperty(entry, context);
	else {
		// Missing fixture evidence is not an allowed SHOULD deviation.
		if (entry.rule === "case-identity-stable-across-runs")
			assert.ok(context.repeated?.length >= 2, "Missing repeated-run evidence");
		if (entry.rule === "coordinates-run-and-shard-identity")
			assert.ok(context.shards?.length >= 2, "Missing shard evidence");
		assert.ok(
			reportChecks[entry.rule],
			`Unimplemented shared rule ${entry.rule}`,
		);
		try {
			reportChecks[entry.rule](context);
		} catch (error) {
			if (!recommendedRules.has(entry.rule)) throw error;
			context.warnings ??= [];
			context.warnings.push(`${entry.id} (SHOULD): ${error.message}`);
		}
	}
}

export function disposition(entry, manifest) {
	const capability =
		entry.kind === "property"
			? manifest.properties[entry.path]
			: manifest.rules[entry.rule];
	assert.ok(capability, `No capability declaration for ${entry.id}`);
	assert.ok(capability.reason, `Missing capability reason for ${entry.id}`);
	return capability;
}
