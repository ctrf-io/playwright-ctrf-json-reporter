import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
	},
	format: ["esm", "cjs"],
	external: ["@playwright/test", "playwright-core"],
	dts: {
		// tsup injects baseUrl; scope this option to the TypeScript 6 API build.
		compilerOptions: { ignoreDeprecations: "6.0" },
		entry: { index: "src/index.ts" },
	},
	clean: true,
	shims: true,
	outDir: "dist",
});
