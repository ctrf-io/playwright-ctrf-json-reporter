/**
 * Unit tests for GenerateCtrfReport deep merge functionality
 */

import GenerateCtrfReport from "./generate-report";
import type { TestError, WorkerInfo } from "@playwright/test/reporter";

describe("GenerateCtrfReport", () => {
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
