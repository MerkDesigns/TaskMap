import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "**/dist-installer/**",
      "**/dist-migrator/**",
      "**/tools/legacy-migrator/writer/target/**",
      "**/installer/gen/**",
      "**/installer/target/**",
      "**/node_modules/**",
      "**/src-tauri/gen/**",
      "**/src-tauri/target/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/src/**/*.{ts,tsx}", "**/tools/**/*.ts"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.config.{js,cjs,mjs,ts}", "**/scripts/**/*.mjs", "**/tools/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
