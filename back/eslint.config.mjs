import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// TASK-036: every active rule is an error, matching front/eslint.config.mjs (TASK-033). An
// exception needs `// eslint-disable-next-line <rule> -- <reason>` and a line in TASK-036 section 6.
function toError(entry) {
  const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
  if (severity === "off" || severity === 0) return entry;
  return options.length ? ["error", ...options] : "error";
}

function asErrors(config) {
  if (!config.rules) return config;
  return { ...config, rules: Object.fromEntries(Object.entries(config.rules).map(([name, entry]) => [name, toError(entry)])) };
}

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
].map(asErrors).concat([
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  globalIgnores(["dist/**", "src/generated/**"]),
]));
