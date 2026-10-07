const stringTerminator = "(?:\\u0007|\\u001B\\u005C|\\u009C)";
// The payload stops at the first terminator-class character so an
// unterminated `ESC ]` cannot consume (or rescan) the rest of the input.
const osc = `(?:\\u001B\\][^\\u0007\\u001B\\u009C]*${stringTerminator})`;
const csi =
	"[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]";

// Same grammar as `ansi-regex` 6.3, built from a string so the
// pattern can contain control characters without tripping the linter.
const ansiPattern = new RegExp(`${osc}|${csi}`, "g");

export function stripAnsi(text: string): string {
	return text.replace(ansiPattern, "");
}
