import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    // pnpm 的虚拟store 与工作区软链接会带进生成产物，它们不属于本仓库的源码
    "node_modules/**",
    "**/node_modules/**",
    "next-env.d.ts",
    ".qa/out/**",
  ]),
]);
