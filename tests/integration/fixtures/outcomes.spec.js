import { test, expect } from "@playwright/test";
import { extra } from "playwright-ctrf-json-reporter";
import { writeFileSync } from "node:fs";

async function attachEvidence(name, content) {
	const path = test.info().outputPath("evidence.txt");
	writeFileSync(path, content);
	await test.info().attach(name, { path, contentType: "text/plain" });
}

test.describe("integration", () => {
	test("passes", async () => {
		test.info().annotations.push({ type: "issue", description: "smoke" });
		await extra({ smoke: { first: true }, values: [1] });
		await extra({ smoke: { second: true }, values: [2] });
		await attachEvidence("evidence", "passed");
		expect(1).toBe(1);
	});

	test("fails", () => {
		expect(1).toBe(2);
	});

	test.skip("skipped", () => {});

	test("expected failure", () => {
		test.fail();
		expect(1).toBe(2);
	});

	test("passes on retry", async () => {
		await attachEvidence("retry evidence", `attempt ${test.info().retry}`);
		expect(test.info().retry).toBe(1);
	});
});
