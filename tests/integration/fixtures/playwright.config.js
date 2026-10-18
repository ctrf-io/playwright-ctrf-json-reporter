import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

const scenario = JSON.parse(
	readFileSync(new URL("./scenario.json", import.meta.url)),
);

export default defineConfig({
	testDir: "./tests",
	workers: 1,
	retries: 1,
	timeout: 10_000,
	forbidOnly: true,
	reporter: [
		["list"],
		[
			"playwright-ctrf-json-reporter",
			{
				outputDir: "./reports",
				outputFile: `${scenario.name}.json`,
				...scenario.options,
			},
		],
	],
});
