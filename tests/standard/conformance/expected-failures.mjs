import { runExpectedFailure } from "./shared/expected-failures.mjs";
import { checkEntry } from "./shared/checks.mjs";

// Reporter-specific exceptions; the common catalogue/checker remains unchanged.
export const expectedFailures = {};

export function expectedFailure(entry, level) {
	const issue = expectedFailures[entry.id];
	return issue?.samples[level] ? issue : undefined;
}

export function runConformance(entry, context, level, check = checkEntry) {
	return runExpectedFailure(
		entry,
		context,
		level,
		expectedFailure(entry, level),
		check,
		() => false,
	);
}
