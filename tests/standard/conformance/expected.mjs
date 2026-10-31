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
				// The oracle maps source statuses independently of the adapter
				// under test: a timeout is a failure, an interruption is neither
				// a pass nor a fail.
				status:
					attempt.status === "timedOut"
						? "failed"
						: attempt.status === "interrupted"
							? "other"
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
			// Flaky means a pass that followed a failure: an interrupted
			// attempt is neither a pass nor a fail, so it does not count. The
			// reporter computes flaky from the final outcome and retry count
			// alone; both definitions agree on every status combination
			// Playwright can produce within a single run.
			flaky:
				test.expectedCtrfStatus === "passed" &&
				test.attempts
					.slice(0, -1)
					.some((attempt) => ["failed", "timedOut"].includes(attempt.status)),
			stdout: last.stdout,
			stderr: last.stderr,
		};
	});
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
		if (
			options[key] !== undefined &&
			(key !== "buildNumber" || Number.isInteger(options[key]))
		)
			environment[key] = options[key];
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
