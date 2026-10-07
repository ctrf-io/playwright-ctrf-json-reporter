import { stripAnsi } from "./strip-ansi";

describe("stripAnsi", () => {
	it("returns plain text unchanged", () => {
		const text = "Expected: 2\n  > 5 |  expect(1).toBe(2);\t✓ ünïcödé";
		expect(stripAnsi(text)).toBe(text);
	});

	it("keeps bracketed text that is not preceded by an escape", () => {
		const text = "expected [31m] to equal ]8;;x[0m; arr[1;2]";
		expect(stripAnsi(text)).toBe(text);
	});

	it("does not let an unterminated OSC swallow the rest of the text", () => {
		const result = stripAnsi(
			"start\u001b]8;;https://example.com\nkeep this\u001b[31mand this\u001b[0m\u0007end",
		);
		expect(result).toContain("keep this");
		expect(result).toContain("and this");
		expect(result).toContain("end");
	});

	it("handles many unterminated OSC introducers in linear time", () => {
		const input = "\u001b]".repeat(50_000);
		const started = performance.now();
		stripAnsi(input);
		expect(performance.now() - started).toBeLessThan(500);
	});

	it("returns an empty string unchanged", () => {
		expect(stripAnsi("")).toBe("");
	});

	it("strips single-parameter SGR sequences", () => {
		expect(
			stripAnsi("\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m"),
		).toBe("expect(received");
	});

	it("strips multi-parameter and reset SGR sequences", () => {
		expect(
			stripAnsi(
				"\u001b[38;5;204m2\u001b[0m \u001b[1;31m^\u001b[m \u001b[38;2;255;0;0mred",
			),
		).toBe("2 ^ red");
	});

	it("strips non-SGR CSI sequences", () => {
		expect(stripAnsi("\u001b[2Kline\u001b[1A")).toBe("line");
	});

	it("strips OSC 8 hyperlinks but keeps their text", () => {
		expect(
			stripAnsi(
				"\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007 and \u001b]8;;https://x.y\u001b\\other\u001b]8;;\u001b\\",
			),
		).toBe("link and other");
	});
});
