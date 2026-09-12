import type { NextConfig } from "next";

/**
 * Fixture 的 Next 配置。
 *
 * ⚠️ 这里**故意什么都没有**。
 *
 * 它是对照组：Local Link（Development Mode）需要
 *   transpilePackages + experimental.externalDir + turbopack.root
 * 三件套，还要求两边的 @types/react 版本一致。
 *
 * Source Installation 之后这些配置**一个都不需要** —— 资产已经是产品
 * 自己的源码，说明符也是相对路径。如果这个文件里出现了任何 @kits/*
 * 相关的配置，说明安装器把依赖泄漏进了产品。
 */
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
