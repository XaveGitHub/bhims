import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
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
		external: ["better-sqlite3"],
	},
});

export default config;
