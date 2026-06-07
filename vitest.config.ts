import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		exclude: [...configDefaults.exclude, "dist/**", "coverage/**", "ctrf/**"],
		reporters: ["default", "@d2t/vitest-ctrf-json-reporter"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "lcov"],
		},
	},
});
