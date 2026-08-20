// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.tsbuildinfo"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.js", "vitest.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // AGENTS.md: `any` is only acceptable at untrusted external boundaries,
      // where it must still be validated via packages/shared before use.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Tooling config files fall back to the default (untyped) program, which
    // doesn't resolve type-only exports like typescript-eslint's `configs`.
    files: ["*.config.js", "vitest.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
