import { createHash } from "node:crypto";
import path from "node:path";

export interface TestIdentity {
	name: string;
	suite?: string[];
	filePath?: string;
	variant?: string;
}

export interface IdentityOptions {
	/** Supply the same value to every document in a coordinated logical run. */
	runId?: string;
	/** Label the partition producing this document, not a test thread. */
	shardId?: string;
	/** Override the deterministic default when the framework cannot distinguish cases. */
	testIdResolver?: (test: TestIdentity) => string;
}

export function identityValue(
	value: string | undefined,
	field: string,
): string | undefined {
	if (
		value !== undefined &&
		(typeof value !== "string" || value.trim().length === 0)
	) {
		throw new Error(`${field} must be a non-empty string`);
	}
	return value;
}

export function testIdentity(
	scope: string,
	test: TestIdentity,
	options: IdentityOptions = {},
): string {
	if (options.testIdResolver) {
		const resolved = options.testIdResolver(test);
		if (resolved === undefined)
			throw new Error("testIdResolver must return a non-empty string");
		return identityValue(resolved, "testId") as string;
	}
	const source = test.filePath?.replaceAll("\\", "/") ?? "";
	const relative = path.isAbsolute(source)
		? path.relative(process.cwd(), source).replaceAll("\\", "/")
		: source;
	// JSON tuples retain component boundaries; delimiter-containing titles cannot collide.
	const tuple = [
		scope,
		path.posix.normalize(relative || "."),
		test.suite ?? [],
		test.name,
		test.variant ?? "",
	];
	return `ctrf:${scope}:v1:${createHash("sha256").update(JSON.stringify(tuple)).digest("hex")}`;
}
