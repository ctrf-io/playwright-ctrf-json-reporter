import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { catalogue, disposition } from "../shared/checks.mjs";

import { expectedFailure, runConformance } from "../expected-failures.mjs";

const observedExpectedFailures = [];
const manifest = JSON.parse(
	readFileSync(new URL("../playwright.json", import.meta.url), "utf8"),
);
const context = JSON.parse(
	readFileSync(process.env.CTRF_CONFORMANCE_CONTEXT, "utf8"),
);
for (const sample of context.samples)
	sample.bytes = Buffer.from(sample.base64, "base64");
context.repeated = context.repeated.map((name) =>
	context.samples.find((sample) => sample.name === name),
);
context.shards = context.shards.map((name) =>
	context.samples.find((sample) => sample.name === name),
);

for (const entry of catalogue.entries) {
	const capability = disposition(entry, manifest);
	const issue = expectedFailure(entry, "integration");
	test(`${entry.id}${issue ? ` [expected failure: ${issue.issue}]` : ""}`, {
		skip: capability.supported ? false : capability.reason,
	}, () => {
		const result = runConformance(entry, context, "integration");
		if (result) observedExpectedFailures.push(result);
	});
}

after(() => {
	console.log(
		`Conformance expected failures (base64): ${Buffer.from(JSON.stringify(observedExpectedFailures)).toString("base64")}`,
	);
	console.log(
		`Conformance recommendations: ${JSON.stringify(context.warnings)}`,
	);
});
