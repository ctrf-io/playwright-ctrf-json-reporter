import assert from "node:assert/strict";
import { valuesAt } from "./checks.mjs";

export function runExpectedFailure(
	entry,
	context,
	level,
	issue,
	check,
	matchesKnownFailure,
) {
	if (!issue?.samples[level]) return check(entry, context);
	const expectedSamples = new Set(issue.samples[level]);
	for (const name of expectedSamples)
		assert.equal(
			context.samples.filter((sample) => sample.name === name).length,
			1,
			`Expected-failure fixture missing or duplicated: ${name}`,
		);
	// Check every sample, including those after the original first failure.
	for (const sample of context.samples) {
		const parentPath = entry.path?.split(".").slice(0, -1).join(".");
		const hasParent =
			!parentPath || valuesAt(sample.report, parentPath).length > 0;
		// Optional absence in other modes is legitimate. The required known-bug
		// samples below still have to emit and reproduce their exact violation.
		if (
			entry.kind === "property" &&
			(!entry.required || !hasParent) &&
			!expectedSamples.has(sample.name) &&
			valuesAt(sample.report, entry.path).length === 0
		)
			continue;
		let failure;
		try {
			check(entry, { ...context, samples: [sample] });
		} catch (error) {
			failure = error;
		}
		if (!expectedSamples.has(sample.name)) {
			if (failure) throw failure;
			continue;
		}
		assert.ok(
			failure,
			`Unexpected pass: ${entry.id} / ${sample.name}; review and remove the expected-failure marker`,
		);
		if (!matchesKnownFailure(entry, sample, issue, failure)) throw failure;
	}
	return {
		id: entry.id,
		level,
		samples: [...expectedSamples],
		issue: issue.issue,
		reason: issue.reason,
		followUp: issue.followUp,
	};
}
