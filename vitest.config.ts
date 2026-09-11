import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 全部测试是「静态审计」：读文件、解析 JSON、检查契约一致性。
    // 不需要 DOM —— 组件的 SSR 兼容性用源码静态检查覆盖（见 tests/ssr-fallbacks.spec.ts）。
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    reporters: ["default"],
  },
});
