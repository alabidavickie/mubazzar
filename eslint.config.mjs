import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react's "detect" uses an API removed in ESLint 10; declare the version instead.
    settings: { react: { version: "19.3" } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design/**",
    "reports/**",
    "test-results/**",
    ".data/**",
    ".claude/**",
    "src/server/db/types.ts",
    "src/components/icons/paths.ts",
  ]),
]);

export default eslintConfig;
