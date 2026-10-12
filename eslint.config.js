// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // `tools/` and `research/` are development-only and not tracked by git; the game-data
    // extractor lives in a separate C# project.
    ignores: ["dist", "node_modules", "tools", "research"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      parserOptions: {
        project: "tsconfig.lint.json",
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
  {
    // The test files are plain JavaScript run directly by `node --test`, so they belong to no
    // tsconfig and cannot be type-aware linted. They also have no annotations to check.
    files: ["tests/**/*.mjs"],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
