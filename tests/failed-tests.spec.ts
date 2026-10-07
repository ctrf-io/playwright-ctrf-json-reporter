import { createFailedTestSuite } from "./dummy-suites/failed-test-suite";
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

describe("Failed Tests", () => {
	it("should generate report with error details correctly", async () => {
		// Arrange
		const testSuite = createFailedTestSuite();
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
		expect(parsedReport.results.tests).toHaveLength(2);
		expect(parsedReport.results.tests[0].suite).toEqual(["Failed Test Suite"]);
		expect(parsedReport.results.tests[0].status).toBe("failed");
		expect(parsedReport.results.tests[0].rawStatus).toBe("failed");
		expect(parsedReport.results.tests[0].status).toBe("failed");
		expect(parsedReport.results.tests[0].message).toBe("test-error-message");
		expect(parsedReport.results.tests[0].trace).toBe("test-error-stack");
		expect(parsedReport.results.tests[0].snippet).toBe("test-error-snippet");
		expect(parsedReport.results.tests[1].status).toBe("passed");
		expect(parsedReport.results.tests[1].rawStatus).toBe("failed");
		expect(parsedReport.results.tests[1].message).toBe("test-error-message");
		expect(parsedReport.results.tests[1].trace).toBe("test-error-stack");
		expect(parsedReport.results.tests[1].snippet).toBe("test-error-snippet");
		expect(parsedReport.results.summary).toMatchObject({
			tests: 2,
			passed: 1,
			failed: 1,
			pending: 0,
			skipped: 0,
			other: 0,
		});
	});

	it("should strip ANSI escape sequences from error details", async () => {
		const testSuite = createFailedTestSuite(ansiTestError);
		const report = new GenerateCtrfReport();

		report.onBegin(undefined as any, testSuite);
		report.onEnd();

		const reportJsonContent = mockedFs.writeFileSync.mock
			.lastCall?.[1] as string;
		const parsedReport: CTRFReport = JSON.parse(reportJsonContent);

		expect(parsedReport.results.tests).toHaveLength(2);
		for (const test of parsedReport.results.tests) {
			expect(test.message).toBe(plainTestError.message);
			expect(test.trace).toBe(plainTestError.stack);
			expect(test.snippet).toBe(plainTestError.snippet);
		}
	});
});
