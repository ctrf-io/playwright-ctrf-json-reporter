const fs = require("node:fs");

class NativeWitness {
	onConfigure(config) {
		this.version = config.version;
	}
	onBegin(config, suite) {
		this.version = config.version;
		this.suite = suite;
	}
	onEnd() {
		const tests = (this.suite?.allTests() ?? [])
			.filter((test) => test.results.length)
			.map((test) => {
				const final = test.results.at(-1);
				let expectedCtrfStatus;
				if (final.status === "skipped") expectedCtrfStatus = "skipped";
				else if (final.status === "interrupted") expectedCtrfStatus = "other";
				else if (test.outcome() === "unexpected") expectedCtrfStatus = "failed";
				else expectedCtrfStatus = "passed";
				return {
					id: test.id,
					name: test.title,
					expectedCtrfStatus,
					suite: test.titlePath().slice(0, -1).filter(Boolean),
					tags: test.tags,
					filePath: test.location.file,
					attempts: test.results.map((result) => ({
						status: result.status,
						duration: result.duration,
						startTime: result.startTime.toISOString(),
						stdout: result.stdout.map((value) => value.toString()),
						stderr: result.stderr.map((value) => value.toString()),
					})),
				};
			});
		fs.writeFileSync(
			"native.json",
			JSON.stringify({ version: this.version, tests }),
		);
	}
}
module.exports = NativeWitness;
