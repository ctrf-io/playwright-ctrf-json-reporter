import { describe, it, expect } from "vitest";
import { identityValue, runIdentity, testIdentity } from "../src/identity";

describe("identity semantics", () => {
	it("normalizes paths but preserves suite component boundaries", () => {
		const a = {
			name: "same",
			suite: ["a/b", "c"],
			filePath: "tests\\example.ts",
		};
		expect(testIdentity("runner", a)).toBe(
			testIdentity("runner", { ...a, filePath: "tests/example.ts" }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, suite: ["a", "b/c"] }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, filePath: "tests/other.ts" }),
		);
	});
	it("shares configured run identity and creates independent standalone runs", () => {
		expect(runIdentity("coordinated-run")).toBe("coordinated-run");
		expect(runIdentity()).not.toBe(runIdentity());
		expect(() => identityValue(" ", "shardId")).toThrow();
	});
	it("supports an explicit case resolver without allowing empty identity", () => {
		expect(
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "stable-case" },
			),
		).toBe("stable-case");
		expect(() =>
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "" },
			),
		).toThrow();
	});
});

import Reporter from "../src/generate-report";
it("identifies one execution with distinct prior attempts and attachment references", () => {
	const reporter = new Reporter({ runId: "run", shardId: "one" });
	const result = {
		status: "passed",
		duration: 1,
		retry: 2,
		startTime: new Date(),
		attachments: [{ name: "log", contentType: "text/plain", path: "log.txt" }],
		steps: [],
		stdout: [],
		stderr: [],
	};
	const test = {
		id: "native",
		title: "case",
		location: { file: "a.ts" },
		results: [
			{ ...result, status: "failed" },
			{ ...result, status: "failed" },
			result,
		],
		parent: undefined,
	};
	reporter.updateCtrfTestResultsFromTestResult(
		test as never,
		result as never,
		reporter.ctrfReport,
		"passed",
	);
	const emitted = reporter.ctrfReport.results.tests[0];
	expect(emitted.testId).toBe("native");
	expect(emitted.executionId).toBeTruthy();
	expect(emitted.attemptId).toBeTruthy();
	expect(
		emitted.retryAttempts?.map((attempt) => attempt.attemptId),
	).not.toContain(emitted.attemptId);
	expect(
		new Set(emitted.retryAttempts?.map((attempt) => attempt.attemptId)).size,
	).toBe(2);
	const refs = [
		...(emitted.attachments ?? []),
		...(emitted.retryAttempts ?? []).flatMap(
			(attempt) => attempt.attachments ?? [],
		),
	];
	expect(new Set(refs.map((attachment) => attachment.attachmentId)).size).toBe(
		3,
	);
	const snapshot = JSON.parse(JSON.stringify(reporter.ctrfReport));
	expect(snapshot.results.tests[0].executionId).toBe(emitted.executionId);
	expect(snapshot.results.tests[0].attemptId).toBe(emitted.attemptId);
	expect(
		snapshot.results.tests[0].retryAttempts.map(
			(attempt: { attemptId: string }) => attempt.attemptId,
		),
	).toEqual(emitted.retryAttempts?.map((attempt) => attempt.attemptId));
});
