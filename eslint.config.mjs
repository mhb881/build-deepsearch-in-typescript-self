import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import simpleImportSort from "eslint-plugin-simple-import-sort";
/**
 * 官方推荐使用 projectService: true 代替过时的 project: ["./tsconfig.json"]。
 * 它会使用与 VS Code TypeScript 相同的 Project Service 引擎，大幅减少冷启动开销并共享缓存。
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs, // 已内置 typescript-eslint/recommended，无需重复导入
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    files: ["src/**/*.{ts,tsx}"],
    // languageOptions: {
    //   parserOptions: {
    //     projectService: true, // 启用 Project Service，比 project: [...] 显著提升 IDE 性能
    //     tsconfigRootDir: import.meta.dirname,
    //   },
    // },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // "@typescript-eslint/consistent-type-imports": [
      //   "warn",
      //   {
      //     prefer: "type-imports",
      //     fixStyle: "inline-type-imports",
      //   },
      // ],
      // "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      // "@typescript-eslint/array-type": "off",
      // "@typescript-eslint/consistent-type-definitions": "off",
      // "@typescript-eslint/require-await": "off",
      // "@typescript-eslint/no-misused-promises": [
      //   "error",
      //   {
      //     checksVoidReturn: { attributes: false },
      //   },
      // ],
      // "@typescript-eslint/await-thenable": "error",
      // "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
