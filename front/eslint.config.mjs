import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import jsxA11y from "eslint-plugin-jsx-a11y";

// TASK-023, decision 2: every rule starts as a warning so the first run does not force fixing
// existing code. A later task promotes them to errors. rules-of-hooks stays an error: breaking
// it is always a bug.
function toWarning(entry) {
  const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
  if (severity === "off" || severity === 0) return entry;
  return options.length ? ["warn", ...options] : "warn";
}

function asWarnings(config) {
  if (!config.rules) return config;
  return { ...config, rules: Object.fromEntries(Object.entries(config.rules).map(([name, entry]) => [name, toWarning(entry)])) };
}

export default defineConfig([
  ...nextVitals,
  // The jsx-a11y plugin is already registered by the Next config; only its recommended rules are added.
  { rules: jsxA11y.flatConfigs.recommended.rules },
].map(asWarnings).concat([
  { rules: { "react-hooks/rules-of-hooks": "error" } },
  { linterOptions: { reportUnusedDisableDirectives: "warn" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]));
