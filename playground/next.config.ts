import type { NextConfig } from "next";

/**
 * Playground 的 Next.js 配置。
 *
 * 关键决定：**transpilePackages** 列出所有 Kits 包。
 * 它们是源码分发（`.ts` / `.tsx` / `.css`），没有构建产物 ——
 * 这正是"可审计"的代价：你在 Playground 里看到的，就是产品会装到的东西。
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    "@kits/style-editorial",
    "@kits/style-cinematic",
    "@kits/style-instrument",
    "@kits/interactive-hero",
    "@kits/spotlight-surface",
    "@kits/animated-grid",
    "@kits/data-cursor",
    "@kits/insight-reveal",
  ],
};

export default nextConfig;
