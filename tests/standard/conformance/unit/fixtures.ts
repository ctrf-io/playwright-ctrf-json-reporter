import fs from "node:fs";
import { vi } from "vitest";
import type {
	FullConfig,
	Suite,
	TestCase,
	TestResult,
} from "@playwright/test/reporter";
import GenerateCtrfReport from "../../../../src/generate-report";
import { configuredOptions, expectedReport } from "../expected.mjs";

const epoch = Date.parse("2026-10-17T12:00:00Z");
const image = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
	"base64",
);

function result(status: string, retry: number): TestResult {
	const failed = ["failed", "timedOut"].includes(status);
	return {
		status,
		retry,
		duration: 10 + retry,
		startTime: new Date(epoch + retry * 30),
		error: failed
			? {
					message: `failure-${retry}`,
					stack: `trace-${retry}`,
					snippet: `snippet-${retry}`,
				}
			: undefined,
		errors: [],
		attachments: [
			{
				name: `evidence-${retry}`,
				contentType: "text/plain",
				path: `/fixture/evidence-${retry}.txt`,
			},
			{ name: "screenshot", contentType: "image/png", body: image },
			{
				name: "metadata.json",
				contentType: "application/json",
				body: Buffer.from(
					JSON.stringify({ name: "chromium", version: "fixture-version" }),
				),
			},
			{
				name: "runtime",
				contentType: "application/vnd.ctrf.message+json",
				body: Buffer.from(
					JSON.stringify({
						type: "metadata",
						data: { "fixture.metadata": { retry, enabled: false, zero: 0 } },
					}),
				),
			},
		],
		steps: [
			{
				title: "outer step",
				category: "test.step",
				steps: [{ title: "inner step", category: "test.step", steps: [] }],
			},
		],
		stdout: [Buffer.from("stdout"), "second line"],
		stderr: [Buffer.from("stderr")],
	} as unknown as TestResult;
}

function suite() {
	const root = {
		title: "",
		parent: undefined,
		tests: [],
		suites: [],
	} as unknown as Suite;
	const file = {
		title: "fixture.spec.ts",
		parent: root,
		tests: [],
		suites: [],
	} as unknown as Suite;
	const group = {
		title: "standard",
		parent: file,
		suites: [],
	} as unknown as Suite;
	const definitions: [string, string[], string, string][] = [
		["passes", ["passed"], "passed", "passed"],
		["fails", ["failed", "failed", "failed"], "passed", "failed"],
		["recovers", ["failed", "failed", "passed"], "passed", "passed"],
		["skipped", ["skipped"], "passed", "skipped"],
		["pending", ["pending"], "passed", "pending"],
		["other", ["unknown"], "passed", "other"],
		["expected failure", ["failed"], "failed", "passed"],
		["unexpected pass", ["passed"], "failed", "failed"],
		[
			"unexpected pass exhausts retries",
			["passed", "passed", "passed"],
			"failed",
			"failed",
		],
		["expected failure after retry", ["passed", "failed"], "failed", "passed"],
		["timeout", ["timedOut"], "passed", "failed"],
		["interrupted", ["interrupted"], "passed", "other"],
		["interrupted-retries", ["interrupted", "interrupted"], "passed", "other"],
	];
	group.tests = definitions.map(([name, attempts, expectedStatus]) => ({
		id: `native:${name}`,
		title: name,
		expectedStatus,
		location: { file: "/fixture/fixture.spec.ts", line: 10, column: 1 },
		tags: ["@standard"],
		annotations: [{ type: "issue", description: "fixture" }],
		parent: group,
		results: attempts.map((status, retry) => result(status, retry)),
	})) as unknown as TestCase[];
	file.suites = [group];
	root.suites = [file];
	for (const value of [root, file, group]) value.allTests = () => group.tests;
	const native = {
		version: "1.64.0",
		tests: group.tests.map((test, index) => ({
			id: test.id,
			name: test.title,
			expectedCtrfStatus: definitions[index][3],
			suite: [file.title, group.title],
			tags: test.tags,
			filePath: test.location.file,
			attempts: test.results.map((attempt) => ({
				...attempt,
				stdout: ["stdout", "second line"],
				stderr: ["stderr"],
			})),
		})),
	};
	return { root, native };
}

export function unitContext() {
	const samples: any[] = [];
	vi.useFakeTimers();
	const write = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
	const exists = vi.spyOn(fs, "existsSync").mockReturnValue(true);
	const log = vi.spyOn(console, "log").mockImplementation(() => {});
	try {
		for (const [name, options] of [
			["full", { ...configuredOptions, screenshot: true, annotations: true }],
			["repeated", { ...configuredOptions, screenshot: true }],
			["minimal", { minimal: true }],
			["shard-one", { ...configuredOptions, shardId: "one" }],
			["shard-two", { ...configuredOptions, shardId: "two" }],
			["fractional-build-number", { ...configuredOptions, buildNumber: 1.5 }],
			[
				"nonfinite-build-number",
				{ ...configuredOptions, buildNumber: Number.POSITIVE_INFINITY },
			],
		] as const) {
			vi.setSystemTime(epoch);
			const { root, native } = suite();
			let reporter: GenerateCtrfReport;
			try {
				reporter = new GenerateCtrfReport(options);
				reporter.onBegin({ version: native.version } as FullConfig, root);
			} catch (error) {
				// An adapter may reject invalid configuration instead of emitting it.
				if (!name.includes("build-number")) throw error;
				continue;
			}
			reporter.onError({ message: "global diagnostic" });
			vi.setSystemTime(epoch + 1000);
			reporter.onEnd();
			const bytes = Buffer.from(String(write.mock.lastCall?.[1]), "utf8");
			const report = JSON.parse(bytes.toString("utf8"));
			const expected = expectedReport(native, options);
			expected.results.summary.start = epoch;
			expected.results.summary.stop = epoch + 1000;
			expected.results.summary.duration = 1000;
			// Invalid configuration may be rejected or omitted. It must never
			// turn into an accepted invalid report; schema checks decide this.
			if (name.includes("build-number"))
				delete expected.results.environment.buildNumber;
			samples.push({ name, bytes, report, expected });
		}
	} finally {
		write.mockRestore();
		exists.mockRestore();
		log.mockRestore();
		vi.useRealTimers();
	}
	return {
		samples,
		repeated: samples.filter((sample) =>
			["full", "repeated"].includes(sample.name),
		),
		shards: samples.filter((sample) => sample.name.startsWith("shard-")),
		producerExtensionKeys: ["errors", "annotations", "fixture.metadata"],
		warnings: [] as string[],
	};
}
