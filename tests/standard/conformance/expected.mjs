// Playwright adapter oracle. The shared checker imports neither the reporter
// implementation nor this framework-specific mapping.
export function expectedReport(native, options = {}) {
	const cases = native.tests.map((test) => {
		const last = test.attempts.at(-1);
		const base = {
			name: test.name,
			testId: options.customIdentity ? `custom:${test.name}` : test.id,
			status: test.expectedCtrfStatus,
			duration: last.duration,
			sourceAttempts: test.attempts.map((attempt) => ({
				status: ["timedOut", "interrupted"].includes(attempt.status)
					? "failed"
					: attempt.status,
				duration: attempt.duration,
			})),
		};
		if (options.minimal) return base;
		return {
			...base,
			start: new Date(last.startTime).getTime(),
			stop: new Date(last.startTime).getTime() + last.duration,
			rawStatus: last.status,
			suite: test.suite,
			tags: test.tags,
			type: options.testType ?? "e2e",
			filePath: test.filePath,
			retries: test.attempts.length - 1,
			flaky:
				test.expectedCtrfStatus === "passed" &&
				test.attempts
					.slice(0, -1)
					.some((attempt) =>
						["failed", "timedOut", "interrupted"].includes(attempt.status),
					),
			stdout: last.stdout,
			stderr: last.stderr,
		};
	});
	// A run that Playwright ends in a non-passed state without any failed
	// test is reported as one synthetic failure, keeping the summary and the
	// tests array consistent (issue 120).
	if (
		native.runStatus !== undefined &&
		native.runStatus !== "passed" &&
		!cases.some((test) => test.status === "failed")
	) {
		cases.push({
			name: "Playwright run-level failure",
			status: "failed",
			duration: 0,
			...(options.minimal ? {} : { rawStatus: native.runStatus }),
		});
	}
	const summary = { tests: cases.length };
	for (const status of ["passed", "failed", "pending", "skipped", "other"])
		summary[status] = cases.filter((test) => test.status === status).length;
	const environment = {};
	for (const key of [
		"appName",
		"appVersion",
		"buildName",
		"buildNumber",
		"buildUrl",
		"repositoryName",
		"repositoryUrl",
		"commit",
		"branchName",
		"osPlatform",
		"osRelease",
		"osVersion",
		"testEnvironment",
		"shardId",
	]) {
		if (options[key] !== undefined) environment[key] = options[key];
	}
	return {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		generatedBy: "playwright-ctrf-json-reporter",
		...(options.runId ? { runId: options.runId } : {}),
		results: {
			tool: { name: "playwright", version: native.version },
			summary,
			tests: cases,
			environment,
		},
	};
}

export const configuredOptions = {
	runId: "standard-run",
	shardId: "standard-shard",
	appName: "fixture-app",
	appVersion: "2.0.0",
	buildName: "standard-build",
	buildNumber: 0,
	buildUrl: "https://example.test/build/0",
	repositoryName: "fixture-repository",
	repositoryUrl: "https://example.test/repository",
	commit: "fixture-commit",
	branchName: "fixture-branch",
	osPlatform: "fixture-platform",
	osRelease: "fixture-release",
	osVersion: "fixture-version",
	testEnvironment: "fixture-environment",
};
