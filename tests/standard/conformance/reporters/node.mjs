import { writeReport } from "./ctrf.mjs";

export default async function* conformanceCtrfReporter(events) {
	const start = Date.now();
	const records = [];
	for await (const { type, data } of events) {
		if (type !== "test:pass" && type !== "test:fail") continue;
		if (
			data.details.type === "suite" ||
			data.details.error?.failureType === "subtestsFailed"
		)
			continue;
		records.push({
			name: data.name,
			status: data.todo
				? "pending"
				: data.skip
					? "skipped"
					: type === "test:fail"
						? "failed"
						: "passed",
			duration: data.details.duration_ms,
			filePath: data.file,
			message:
				data.details.error?.cause?.message ??
				data.details.error?.message ??
				(typeof data.skip === "string" ? data.skip : undefined),
			trace: data.details.error?.cause?.stack ?? data.details.error?.stack,
		});
	}
	writeReport(
		records,
		process.env.CTRF_CONFORMANCE_LEVEL ?? "integration",
		"node:test",
		start,
	);
	yield "";
}
