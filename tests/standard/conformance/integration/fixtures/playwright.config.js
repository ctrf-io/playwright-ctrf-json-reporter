import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const scenario = JSON.parse(readFileSync("scenario.json", "utf8"));
const options = {
	outputDir: "reports",
	outputFile: "report.json",
	...scenario.options,
};
delete options.customIdentity;
if (scenario.options?.customIdentity)
	options.testIdResolver = (test) => `custom:${test.name}`;

export default defineConfig({
	globalSetup: scenario.globalSetup ? "./global-setup.cjs" : undefined,
	testDir: "./tests",
	testMatch: `${scenario.fixture ?? "outcomes"}.spec.js`,
	workers: scenario.workers ?? 1,
	fullyParallel: scenario.workers === 2 || Boolean(scenario.shard),
	retries: scenario.retries ?? 0,
	timeout: 5000,
	forbidOnly: true,
	reporter: [
		["./native-reporter.cjs"],
		["playwright-ctrf-json-reporter", options],
	],
});
