import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import jsxA11y from "eslint-plugin-jsx-a11y";

// TASK-033: every active rule is an error. Shared configs may ship rules at a lower severity,
// so each entry is promoted here. An exception needs
// `// eslint-disable-next-line <rule> -- <reason>` and a line in the task's section 6.
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
  ...nextVitals,
  // The jsx-a11y plugin is already registered by the Next config; only its recommended rules are added.
  { rules: jsxA11y.flatConfigs.recommended.rules },
].map(asErrors).concat([
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]));
