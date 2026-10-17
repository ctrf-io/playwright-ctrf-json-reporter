import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { catalogue, checkEntry, disposition } from "../shared/checks.mjs";
import { unitContext } from "./fixtures";

const manifest = JSON.parse(
	readFileSync(new URL("../playwright.json", import.meta.url), "utf8"),
);
let context: ReturnType<typeof unitContext>;
beforeAll(() => {
	context = unitContext();
});

afterAll(() => {
	if (context.warnings.length)
		console.warn(
			`Conformance recommendations: ${JSON.stringify(context.warnings)}`,
		);
});

describe("CTRF 0.2.0 standard conformance / unit", () => {
	for (const entry of catalogue.entries) {
		const capability = disposition(entry, manifest);
		if (!capability.supported)
			it.skip(`${entry.id} — ${capability.reason}`, () => {});
		else it(entry.id, () => checkEntry(entry, context));
	}
});
