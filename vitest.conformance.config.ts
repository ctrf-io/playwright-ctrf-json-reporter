import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/standard/conformance/unit/**/*.test.ts"],
		environment: "node",
		reporters: ["default"],
		fileParallelism: false,
	},
});
