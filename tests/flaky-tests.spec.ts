import { createFlakyTestSuite } from "./dummy-suites/flaky-test-suite";
import { ansiTestError, plainTestError } from "./dummy-suites/ansi-error";
import GenerateCtrfReport from "../src/generate-report";
import fs from "node:fs";
import { CURRENT_SPEC_VERSION, validateStrict, type CTRFReport } from "ctrf";
import { vi } from "vitest";

vi.mock("node:fs", () => ({
	default: {
		writeFileSync: vi.fn(),
		existsSync: vi.fn(() => true),
	},
	writeFileSync: vi.fn(),
	existsSync: vi.fn(() => true),
}));
const nowDateMock = new Date("2023-01-01T00:00:00.000Z");
vi.useFakeTimers().setSystemTime(nowDateMock);

const mockedFs = vi.mocked(fs);

describe("Flaky Tests", () => {
	it("should generate report with retry attempts correctly", async () => {
		// Arrange
		const testSuite = createFlakyTestSuite();
		const report = new GenerateCtrfReport();

		// Act
		report.onBegin(undefined as any, testSuite);
		report.onEnd();

		// Assert
		expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);

		const reportJsonContent = mockedFs.writeFileSync.mock.calls[0][1] as string;
		const parsedReport: CTRFReport = JSON.parse(reportJsonContent);
		validateStrict(parsedReport, { specVersion: CURRENT_SPEC_VERSION });

		expect(parsedReport.specVersion).toBe(CURRENT_SPEC_VERSION);
		expect(parsedReport.results.tests).toHaveLength(1);

		const test = parsedReport.results.tests[0];

		expect(test.status).toBe("passed");
		expect(test.retries).toBe(2);
		expect(test.flaky).toBe(true);
		expect(test.duration).toBe(888);

		expect(test.retryAttempts).toHaveLength(2);

		const failedAttempt = test.retryAttempts?.[0];
		if (!failedAttempt) {
			throw new Error("Expected first retry attempt to exist");
		}
		expect(failedAttempt.status).toBe("failed");
		expect(failedAttempt.duration).toBe(4444);
		expect(failedAttempt.message).toBe("test-error-message");
		expect(failedAttempt.trace).toBe("test-error-stack");
		expect(failedAttempt.snippet).toBe("test-error-snippet");

		const failedAttempt2 = test.retryAttempts?.[1];
		if (!failedAttempt2) {
			throw new Error("Expected second retry attempt to exist");
		}
		expect(failedAttempt2.status).toBe("failed");
		expect(failedAttempt2.duration).toBe(5555);
		expect(failedAttempt2.message).toBe("test-error-message2");
		expect(failedAttempt2.trace).toBe("test-error-stack2");
		expect(failedAttempt2.snippet).toBe("test-error-snippet2");
	});

	it("should strip ANSI escape sequences from retry attempt error details", async () => {
		const testSuite = createFlakyTestSuite(ansiTestError);
		const report = new GenerateCtrfReport();

		report.onBegin(undefined as any, testSuite);
		report.onEnd();

		const reportJsonContent = mockedFs.writeFileSync.mock
			.lastCall?.[1] as string;
		const parsedReport: CTRFReport = JSON.parse(reportJsonContent);

		const failedAttempt = parsedReport.results.tests[0].retryAttempts?.[0];
		expect(failedAttempt?.message).toBe(plainTestError.message);
		expect(failedAttempt?.trace).toBe(plainTestError.stack);
		expect(failedAttempt?.snippet).toBe(plainTestError.snippet);
	});
});
