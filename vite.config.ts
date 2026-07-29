import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
	return {
		resolve: { tsconfigPaths: true },
		plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
		build: {
			rollupOptions: {
				external: ["better-sqlite3"],
			},
		},
		optimizeDeps: {
			exclude: ["better-sqlite3"],
		},
		ssr: {
			noExternal: command === "build" ? true : undefined,
			external: ["better-sqlite3"],
		},
	};
});
