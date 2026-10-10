/**
 * Unit tests for GenerateCtrfReport deep merge functionality
 */

import GenerateCtrfReport from "./generate-report";
import type {
	FullConfig,
	Suite,
	TestCase,
	TestError,
	TestResult,
	WorkerInfo,
} from "@playwright/test/reporter";
import { CURRENT_SPEC_VERSION, validateStrict } from "ctrf";

const fakeSuite = (
	title: string,
	type: Suite["type"],
	suites: Suite[] = [],
	tests: TestCase[] = [],
): Suite => {
	const suite = {
		title,
		type,
		suites,
		tests,
		allTests: (): TestCase[] => [
			...tests,
			...suites.flatMap((child) => child.allTests()),
		],
	} as unknown as Suite;
	return suite;
};

const fakeConfig = { version: "1.63.0" } as unknown as FullConfig;

const fakeTest = (): TestCase => ({ results: [] }) as unknown as TestCase;

const fakeAnnotatedTestCase = (): TestCase => {
	const annotations = [{ type: "issue", description: "CTR-101" }];
	const result = {
		retry: 0,
		duration: 120,
		status: "passed",
		startTime: new Date("2026-10-05T00:00:00.000Z"),
		attachments: [],
		steps: [],
		stdout: [],
		stderr: [],
	} as unknown as TestResult;

	return {
		id: "0b9f6a1c2d3e4f5a6b7c-chromium",
		title: "includes an annotation",
		annotations,
		tags: [],
		expectedStatus: "passed",
		location: { file: "annotations.spec.ts", line: 1, column: 1 },
		parent: undefined,
		results: [result],
	} as unknown as TestCase;
};

describe("GenerateCtrfReport", () => {
	describe("CTRF conformance", () => {
		it("emits and validates against the current CTRF specification", () => {
			const reporter = new GenerateCtrfReport();

			expect(reporter.ctrfReport.specVersion).toBe(CURRENT_SPEC_VERSION);
			expect(() =>
				validateStrict(reporter.ctrfReport, {
					specVersion: CURRENT_SPEC_VERSION,
				}),
			).not.toThrow();
		});

		it("emits suite hierarchy as an ordered array", () => {
			const root = { title: "", parent: undefined } as unknown as Suite;
			const file = {
				title: "sample.spec.ts",
				parent: root,
			} as unknown as Suite;
			const describeSuite = {
				title: "checkout",
				parent: file,
			} as unknown as Suite;
			const test = { parent: describeSuite } as unknown as TestCase;

			const reporter = new GenerateCtrfReport();

			expect(reporter.buildSuitePath(test)).toEqual([
				"sample.spec.ts",
				"checkout",
			]);
		});

		it("emits buildNumber as an integer", () => {
			const reporter = new GenerateCtrfReport({ buildNumber: 100 });

			reporter.setEnvironmentDetails(reporter.reporterConfigOptions);
			reporter.ctrfReport.results.environment = reporter.ctrfEnvironment;

			expect(reporter.ctrfEnvironment.buildNumber).toBe(100);
			expect(() =>
				validateStrict(reporter.ctrfReport, {
					specVersion: CURRENT_SPEC_VERSION,
				}),
			).not.toThrow();
		});
	});

	describe("countSuites", () => {
		let reporter: GenerateCtrfReport;

		beforeEach(() => {
			reporter = new GenerateCtrfReport();
		});

		it("returns 0 for a root suite with no children", () => {
			expect(reporter.countSuites(fakeSuite("", "root"))).toBe(0);
		});

		it("counts nested describe blocks and the file that contains them", () => {
			const inner = fakeSuite("inner", "describe", [], [fakeTest()]);
			const outer = fakeSuite("outer", "describe", [inner]);
			const file = fakeSuite("sample.spec.ts", "file", [outer]);
			const root = fakeSuite("", "root", [file]);

			expect(reporter.countSuites(root)).toBe(3);
		});

		it("does not count the suite it is called on", () => {
			const describeSuite = fakeSuite("outer", "describe");
			const root = fakeSuite("", "root", [describeSuite]);

			expect(reporter.countSuites(root)).toBe(1);
			expect(reporter.countSuites(describeSuite)).toBe(0);
		});

		it("does not count suites with an empty title", () => {
			const project = fakeSuite("", "project", [
				fakeSuite("sample.spec.ts", "file"),
			]);
			const root = fakeSuite("", "root", [project]);

			expect(reporter.countSuites(root)).toBe(1);
		});

		it("counts a suite once per project that runs it", () => {
			const projects = ["chromium", "firefox"].map((name) =>
				fakeSuite(name, "project", [fakeSuite("sample.spec.ts", "file")]),
			);
			const root = fakeSuite("", "root", projects);

			expect(reporter.countSuites(root)).toBe(4);
		});
	});

	describe("onEnd summary.suites", () => {
		it("reports the number of suites in the run", () => {
			const reporter = new GenerateCtrfReport();
			const inner = fakeSuite("inner", "describe", [], [fakeTest()]);
			const outer = fakeSuite("outer", "describe", [inner]);
			const file = fakeSuite("sample.spec.ts", "file", [outer]);
			const root = fakeSuite("", "root", [file]);

			reporter.onBegin(fakeConfig, root);
			reporter.onEnd();

			expect(reporter.ctrfReport.results.summary.suites).toBe(3);
		});
	});

	describe("tool.version", () => {
		it("reports the Playwright version", () => {
			const reporter = new GenerateCtrfReport();

			reporter.onBegin(fakeConfig, fakeSuite("", "root"));

			expect(reporter.ctrfReport.results.tool).toEqual({
				name: "playwright",
				version: "1.63.0",
			});
		});
	});

	describe("summary.duration", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it("reports the run duration as stop minus start", () => {
			vi.useFakeTimers({ now: 1_790_000_000_000 });
			const reporter = new GenerateCtrfReport();

			reporter.onBegin(fakeConfig, fakeSuite("", "root"));
			vi.advanceTimersByTime(1234);
			reporter.onEnd();

			const { summary } = reporter.ctrfReport.results;
			expect(summary.duration).toBe(1234);
			expect(summary.stop - summary.start).toBe(1234);
		});

		it("omits duration when the run never began", () => {
			const reporter = new GenerateCtrfReport();

			reporter.onEnd();

			expect(reporter.ctrfReport.results.summary.duration).toBeUndefined();
		});
	});

	describe("test timestamps", () => {
		it("should express start and stop as Unix epoch milliseconds", () => {
			const reporter = new GenerateCtrfReport();
			const startTime = new Date("2026-09-29T16:10:04.789Z");
			const duration = 4321;

			expect(reporter.updateStart(startTime)).toBe(startTime.getTime());
			expect(reporter.calculateStopTime(startTime, duration)).toBe(
				startTime.getTime() + duration,
			);
		});
	});

	describe("runId", () => {
		it("is generated by default", () => {
			const reporter = new GenerateCtrfReport();

			expect(reporter.ctrfReport.runId).toEqual(expect.any(String));
		});

		it("is emitted when configured", () => {
			const reporter = new GenerateCtrfReport({ runId: "12345-1" });

			expect(reporter.ctrfReport.runId).toBe("12345-1");
			expect(() =>
				validateStrict(reporter.ctrfReport, {
					specVersion: CURRENT_SPEC_VERSION,
				}),
			).not.toThrow();
		});

		it("rejects an empty configured run ID", () => {
			expect(() => new GenerateCtrfReport({ runId: "" })).toThrow("runId");
		});
	});

	describe("testId", () => {
		it("uses Playwright's test case id", () => {
			const reporter = new GenerateCtrfReport();
			const testCase = fakeAnnotatedTestCase();

			reporter.processTest(testCase);

			expect(reporter.ctrfReport.results.tests[0]?.testId).toBe(testCase.id);
		});

		it("is emitted in minimal reports", () => {
			const reporter = new GenerateCtrfReport({ minimal: true });
			const testCase = fakeAnnotatedTestCase();

			reporter.processTest(testCase);

			expect(reporter.ctrfReport.results.tests[0]).toEqual({
				testId: testCase.id,
				executionId: expect.any(String),
				attemptId: expect.any(String),
				name: testCase.title,
				status: "passed",
				duration: 120,
			});
		});

		it("does not emit the legacy id", () => {
			const reporter = new GenerateCtrfReport();

			reporter.processTest(fakeAnnotatedTestCase());

			expect(reporter.ctrfReport.results.tests[0]).not.toHaveProperty("id");
		});
	});

	describe("annotations", () => {
		it("omits annotations by default", () => {
			const reporter = new GenerateCtrfReport();
			const testCase = fakeAnnotatedTestCase();

			reporter.processTest(testCase);

			expect(reporter.ctrfReport.results.tests[0]?.extra).toBeUndefined();
		});

		it("omits annotations when disabled", () => {
			const reporter = new GenerateCtrfReport({ annotations: false });
			const testCase = fakeAnnotatedTestCase();

			reporter.processTest(testCase);

			expect(reporter.ctrfReport.results.tests[0]?.extra).toBeUndefined();
		});

		it("includes annotations when enabled", () => {
			const reporter = new GenerateCtrfReport({ annotations: true });
			const testCase = fakeAnnotatedTestCase();

			reporter.processTest(testCase);

			expect(reporter.ctrfReport.results.tests[0]?.extra).toEqual({
				annotations: testCase.annotations,
			});
		});
	});

	describe("deepMerge", () => {
		let reporter: GenerateCtrfReport;

		beforeEach(() => {
			reporter = new GenerateCtrfReport();
		});

		it("should concatenate arrays", () => {
			const target = { tags: ["smoke"] };
			const source = { tags: ["e2e"] };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ tags: ["smoke", "e2e"] });
		});

		it("should concatenate arrays from empty target", () => {
			const target = {};
			const source = { tags: ["smoke"] };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ tags: ["smoke"] });
		});

		it("should merge objects deeply", () => {
			const target = { build: { id: "123" } };
			const source = { build: { branch: "main" } };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ build: { id: "123", branch: "main" } });
		});

		it("should merge nested objects deeply", () => {
			const target = { meta: { build: { id: "123" } } };
			const source = { meta: { build: { url: "https://..." } } };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({
				meta: { build: { id: "123", url: "https://..." } },
			});
		});

		it("should overwrite primitives", () => {
			const target = { owner: "platform-team" };
			const source = { owner: "checkout-team" };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ owner: "checkout-team" });
		});

		it("should preserve non-overlapping keys", () => {
			const target = { owner: "platform-team", priority: "P1" };
			const source = { retries: 3 };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({
				owner: "platform-team",
				priority: "P1",
				retries: 3,
			});
		});

		it("should handle complex nested structures", () => {
			const target = {
				tags: ["smoke"],
				build: { id: "123", metadata: { author: "alice" } },
				retries: 1,
			};
			const source = {
				tags: ["e2e", "regression"],
				build: { branch: "main", metadata: { timestamp: "2026-02-06" } },
				retries: 2,
				owner: "platform",
			};
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({
				tags: ["smoke", "e2e", "regression"],
				build: {
					id: "123",
					branch: "main",
					metadata: { author: "alice", timestamp: "2026-02-06" },
				},
				retries: 2,
				owner: "platform",
			});
		});

		it("should replace object with primitive", () => {
			const target = { config: { timeout: 5000 } };
			const source = { config: "default" };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ config: "default" });
		});

		it("should replace primitive with object", () => {
			const target = { config: "default" };
			const source = { config: { timeout: 5000 } };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ config: { timeout: 5000 } });
		});

		it("should replace primitive with array", () => {
			const target = { tags: "smoke" };
			const source = { tags: ["e2e"] };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ tags: ["e2e"] });
		});

		it("should handle null values", () => {
			const target = { value: null };
			const source = { value: "something" };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ value: "something" });
		});

		it("should handle empty objects", () => {
			const target = {};
			const source = { owner: "platform" };
			// @ts-expect-error - accessing private method for testing
			const result = reporter.deepMerge(target, source);
			expect(result).toEqual({ owner: "platform" });
		});

		it("should not mutate original objects", () => {
			const target = { tags: ["smoke"], build: { id: "123" } };
			const source = { tags: ["e2e"], build: { branch: "main" } };
			// @ts-expect-error - accessing private method for testing
			reporter.deepMerge(target, source);
			expect(target).toEqual({ tags: ["smoke"], build: { id: "123" } });
			expect(source).toEqual({ tags: ["e2e"], build: { branch: "main" } });
		});
	});
});

describe("onError global errors", () => {
	const globalError = (overrides: Partial<TestError> = {}): TestError => ({
		message: "global setup failed",
		stack:
			"Error: global setup failed\n    at globalSetup (global-setup.ts:12:11)",
		location: { file: "global-setup.ts", line: 12, column: 11 },
		...overrides,
	});

	it("leaves results.extra undefined when there are no global errors", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onEnd();
		expect(reporter.ctrfReport.results.extra).toBeUndefined();
	});

	it("records a global error under results.extra.errors", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(globalError());
		reporter.onEnd();
		expect(reporter.ctrfReport.results.extra).toEqual({
			errors: [
				{
					message: "global setup failed",
					stack:
						"Error: global setup failed\n    at globalSetup (global-setup.ts:12:11)",
					location: { file: "global-setup.ts", line: 12, column: 11 },
				},
			],
		});
	});

	it("keeps every global error in order and records the worker index", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(globalError({ message: "first" }));
		reporter.onError(globalError({ message: "second" }), {
			workerIndex: 3,
		} as WorkerInfo);
		reporter.onEnd();
		const errors = (
			reporter.ctrfReport.results.extra as { errors: Record<string, unknown>[] }
		).errors;
		expect(errors.map((e) => e.message)).toEqual(["first", "second"]);
		expect(errors[0].workerIndex).toBeUndefined();
		expect(errors[1].workerIndex).toBe(3);
	});

	it("omits absent fields instead of emitting undefined", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(
			globalError({
				stack: undefined,
				location: undefined,
				snippet: undefined,
				value: undefined,
			}),
		);
		reporter.onEnd();
		const errors = (
			reporter.ctrfReport.results.extra as { errors: Record<string, unknown>[] }
		).errors;
		expect(Object.keys(errors[0])).toEqual(["message"]);
	});

	it("preserves an existing results.extra value", () => {
		const reporter = new GenerateCtrfReport();
		reporter.ctrfReport.results.extra = { build: { id: "abc" } };
		reporter.onError(globalError());
		reporter.onEnd();
		expect(reporter.ctrfReport.results.extra).toMatchObject({
			build: { id: "abc" },
		});
		expect(
			(reporter.ctrfReport.results.extra as { errors: unknown[] }).errors,
		).toHaveLength(1);
	});

	it("includes a primitive value when one was thrown", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(globalError({ value: "boom" }));
		reporter.onEnd();
		const errors = (
			reporter.ctrfReport.results.extra as { errors: Record<string, unknown>[] }
		).errors;
		expect(errors[0].value).toBe("boom");
	});

	it("omits a non-primitive value", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(
			globalError({ value: { nested: true } as unknown as string }),
		);
		reporter.onEnd();
		const errors = (
			reporter.ctrfReport.results.extra as { errors: Record<string, unknown>[] }
		).errors;
		expect(Object.keys(errors[0])).not.toContain("value");
	});

	it("strips ANSI escape sequences from error text", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(
			globalError({
				message: "\u001b[31mglobal setup failed\u001b[39m",
				stack: "Error: \u001b[1;31mglobal setup failed\u001b[0m\n    at setup",
				snippet: "\u001b[90m 1 |\u001b[39m throw \u001b[38;5;204mboom\u001b[0m",
				value: "\u001b[33mboom\u001b[39m",
			}),
		);
		reporter.onEnd();
		const errors = (
			reporter.ctrfReport.results.extra as { errors: Record<string, unknown>[] }
		).errors;
		expect(errors[0]).toMatchObject({
			message: "global setup failed",
			stack: "Error: global setup failed\n    at setup",
			snippet: " 1 | throw boom",
			value: "boom",
		});
	});

	it("omits message when the error carries none", () => {
		const reporter = new GenerateCtrfReport();
		reporter.onError(
			globalError({
				message: undefined,
				stack: undefined,
				location: undefined,
				snippet: undefined,
				value: undefined,
			}),
		);
		reporter.onEnd();
		const errors = (
			reporter.ctrfReport.results.extra as { errors: Record<string, unknown>[] }
		).errors;
		// `toStrictEqual` rather than `toEqual`: the latter treats a key whose
		// value is `undefined` as absent, which would let an
		// `{ message: undefined }` regression pass unnoticed.
		expect(errors[0]).toStrictEqual({});
		expect(Object.keys(errors[0] ?? {})).toEqual([]);
	});
});
