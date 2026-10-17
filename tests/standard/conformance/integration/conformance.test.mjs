import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { catalogue, checkEntry, disposition } from "../shared/checks.mjs";

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
	test(
		entry.id,
		{ skip: capability.supported ? false : capability.reason },
		() => checkEntry(entry, context),
	);
}

after(() => {
	console.log(
		`Conformance recommendations: ${JSON.stringify(context.warnings)}`,
	);
});
