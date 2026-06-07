import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
	},
	format: ["esm", "cjs"],
	external: ["@playwright/test", "playwright-core"],
	dts: {
		entry: { index: "src/index.ts" },
	},
	clean: true,
	shims: true,
	outDir: "dist",
});
