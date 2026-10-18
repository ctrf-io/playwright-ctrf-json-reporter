import { writeReport } from "./ctrf.mjs";

export default class ConformanceCtrfReporter {
	onTestRunStart() {
		this.start = Date.now();
	}
	onTestRunEnd(modules, unhandledErrors) {
		const records = [];
		for (const module of modules) {
			for (const test of module.children.allTests()) {
				const result = test.result();
				records.push({
					name: test.name,
					status: test.options.mode === "todo" ? "pending" : result.state,
					duration: test.diagnostic()?.duration ?? 0,
					filePath: module.moduleId,
					message:
						result.errors?.map((error) => error.message).join("\n") ??
						result.note,
					trace: result.errors
						?.map((error) => error.stack)
						.filter(Boolean)
						.join("\n"),
				});
			}
			for (const error of module.errors())
				records.push({
					name: `Module error: ${module.moduleId}`,
					status: "failed",
					message: error.message,
					trace: error.stack,
				});
		}
		for (const error of unhandledErrors)
			records.push({
				name: "Unhandled runner error",
				status: "failed",
				message: error.message,
				trace: error.stack,
			});
		writeReport(records, "unit", "vitest", this.start ?? Date.now());
	}
}
