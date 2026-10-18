import { test, expect } from "@playwright/test";
import { extra } from "playwright-ctrf-json-reporter";
import { readFileSync, writeFileSync } from "node:fs";

const scenario = JSON.parse(readFileSync("scenario.json", "utf8"));
const mode = scenario.mode;

async function evidence(label) {
	const file = test.info().outputPath(`${label}.txt`);
	writeFileSync(file, `attempt ${test.info().retry}`);
	await test.info().attach(label, { path: file, contentType: "text/plain" });
}

if (mode === "all-passed") {
	test("passing case", () => expect(true).toBe(true));
} else if (mode === "all-skipped") {
	test.skip("skipped case", () => {});
} else if (mode === "empty-run") {
	// Actual zero-case discovery is intentional.
} else if (mode === "timeout-and-hooks") {
	test("times out", async () => {
		test.setTimeout(100);
		await new Promise((resolve) => setTimeout(resolve, 500));
	});
	test("unexpected pass", () => {
		test.fail();
		expect(1).toBe(1);
	});
	test.describe("setup failure", () => {
		test.beforeEach(() => {
			throw new Error("controlled setup failure");
		});
		test("affected case", () => {});
	});
	test.describe("teardown failure", () => {
		test.afterEach(() => {
			throw new Error("controlled teardown failure");
		});
		test("affected case", () => {});
	});
} else if (mode === "multiple-retries") {
	test("recovers after two failures", async () => {
		await evidence("retry-evidence");
		expect(test.info().retry).toBe(2);
	});
	test("exhausts retries", async () => {
		await evidence("retry-evidence");
		expect(false).toBe(true);
	});
} else if (mode === "workers-and-distinct-cases") {
	for (const group of ["group-one", "group-two"]) {
		test.describe(group, () => {
			for (const row of [1, 2])
				test(`duplicate title row ${row}`, async () => {
					await extra({
						"fixture.metadata": { group, row, worker: test.info().workerIndex },
					});
					await evidence("worker-evidence");
					expect(row).toBeGreaterThan(0);
				});
		});
	}
} else if (mode === "coordinated-shards") {
	test("shard case one", () => expect(1).toBe(1));
	test("shard case two", () => expect(2).toBe(2));
} else if (mode === "browser-evidence") {
	test("real browser evidence", async ({
		page,
		browser,
		browserName,
	}, testInfo) => {
		await page.setContent("<h1>Controlled conformance fixture</h1>");
		await testInfo.attach("metadata.json", {
			body: Buffer.from(
				JSON.stringify({ name: browserName, version: browser.version() }),
			),
			contentType: "application/json",
		});
		await test.step("browser heading", async () => {
			await expect(page.locator("h1")).toHaveText(
				"Controlled conformance fixture",
			);
		});
		await testInfo.attach("screenshot", {
			body: await page.screenshot(),
			contentType: "image/png",
		});
		await extra({ "fixture.metadata": { enabled: false, value: 0 } });
		await evidence("browser-evidence");
		console.log("controlled stdout");
		console.error("controlled stderr");
	});
} else if (mode === "configured-fields") {
	test("configured case @standard", async () => {
		await test.step("configured step", () => expect(true).toBe(true));
		await extra({ "fixture.metadata": { configured: true } });
	});
}
