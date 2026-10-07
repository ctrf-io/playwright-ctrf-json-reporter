import type { TestError } from "@playwright/test/reporter";

/**
 * A failure shaped like Playwright's `expect(1).toBe(2)` output, including the
 * multi-parameter sequences emitted for snippets when color is forced (CI).
 */
export const ansiTestError: TestError = {
	message:
		"Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m2\u001b[39m\nReceived: \u001b[31m1\u001b[39m",
	stack:
		"Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n    at /repo/tests/sample.spec.ts:5:15",
	snippet:
		"\u001b[0m \u001b[90m 4 |\u001b[39m   test(\u001b[32m'fails'\u001b[39m\u001b[33m,\u001b[39m () \u001b[33m=>\u001b[39m {\n\u001b[31m\u001b[1m>\u001b[22m\u001b[39m\u001b[90m 5 |\u001b[39m     expect(\u001b[35m1\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[38;5;204m2\u001b[0m)\u001b[33m;\u001b[39m\n \u001b[90m   |\u001b[39m               \u001b[1;31m^\u001b[0m\u001b[0m",
};

export const plainTestError: TestError = {
	message:
		"Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: 2\nReceived: 1",
	stack:
		"Error: expect(received).toBe(expected)\n    at /repo/tests/sample.spec.ts:5:15",
	snippet:
		"  4 |   test('fails', () => {\n> 5 |     expect(1).toBe(2);\n    |               ^",
};
