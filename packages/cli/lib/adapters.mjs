/**
 * 适配层生成。
 *
 * ---------------------------------------------------------------------------
 * 两个目录，两种所有权
 * ---------------------------------------------------------------------------
 *   installed/   Kits 托管区。属于 Kits，会被重新安装覆盖；产品只读。
 *   adapters/    产品托管区。属于产品，**Kits 永不覆盖**。
 *
 * 这条边界是 Kits 契约里那句「产品只被允许依赖内部稳定 API」的落地方式：
 * 产品 import 的是 adapters/，不是 installed/。
 * 于是升级 Kits（覆盖 installed/）不会碰到产品写的任何一行；
 * 而产品要换实现、加品牌色覆盖、改降级策略，都在 adapters/ 里做。
 *
 * ---------------------------------------------------------------------------
 * 生成器的行为
 * ---------------------------------------------------------------------------
 *   - 文件**不存在** → 生成
 *   - 文件已存在   → 跳过，并报告「保留产品版本」
 *   - 永不覆盖，永不删除
 *
 * 这是 Installer Rules 的第 5 条（不覆盖未知人工修改）在适配层上的体现。
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LAYOUT } from "./lock.mjs";

const BANNER = (assetId, version) => `/**
 * Kits 适配层 · ${assetId} · 由 \`kits add\` 生成（v${version}）
 *
 * ===========================================================================
 * 这个文件属于**产品**，不属于 Kits。
 * ===========================================================================
 *
 *   lib/kits/installed/   Kits 托管区 —— 重新安装会覆盖，产品只读
 *   lib/kits/adapters/    ← 你在这里 —— Kits 永不覆盖这个目录
 *
 * 产品代码请只 import 这一层：
 *
 *   import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";
 *
 * 而不是直接 import 托管区。这样 Kits 升级时，产品的引用面不动。
 *
 * 想改行为（换实现、覆盖品牌色、加自己的降级）就在本文件里改 ——
 * \`kits add\` 不会覆盖它，\`kits doctor\` 也不会把它算作「被改动的托管文件」。
 *
 * 注意 import 路径**不带扩展名**：Kits 源码内部用具名扩展名（workspace 的
 * 源码分发一直开着 allowImportingTsExtensions），但那不该成为产品的要求。
 * 安装器在写盘时会把 .ts / .tsx 剥掉，因此产品不需要改任何 tsconfig。
 */

`;

/**
 * 生成某资产的适配层内容。返回 [{ relPath, content }]
 *
 * @param {any} asset registry 条目
 */
export function adapterFilesFor(asset) {
  // 从 adapters/ 到 installed/<id> 的相对路径
  const up = "../installed/";
  const base = `${up}${asset.id}`;
  const files = [];

  if (asset.type === "style") {
    files.push({
      relPath: `style-${asset.id}.css`,
      content: `/* Kits 适配层 · Style Pack ${asset.id} · v${asset.version}
 *
 * 这个文件属于**产品**。Kits 重新安装不会覆盖它。
 *
 * 引入顺序很重要：契约（含中立兜底值）在前，pack 在后。
 * pack 自己的 tokens.css 已经 @import 了 @kits/contracts 的目标 ——
 * 安装时那条说明符已被重写成托管区内的相对路径，因此这里只需要引 pack。
 */
@import "${base}/tokens.css";

/* 想覆盖品牌色，在这里写（只允许覆盖颜色）：
 *
 * [data-kits-pack="${asset.id}"] {
 *   --kits-color-accent: #your-brand;
 *   --kits-color-accent-ink: #ffffff;
 *   --kits-color-glow: rgb(... / 0.5);
 * }
 *
 * 排版 / 间距 / 密度 / 圆角 / 边界 / 动效一律不要覆盖 ——
 * 那是 pack 的身份，改掉之后就不再是这套风格了。需要不同性格请换 pack。
 */
`,
    });
  }

  if (asset.type === "effect") {
    const entry = (asset.entry ?? "").split("/").pop() ?? "index.css";
    files.push({
      relPath: `effect-${asset.id}.css`,
      content: `/* Kits 适配层 · Effect ${asset.id} · v${asset.version}
 *
 * 这个文件属于**产品**。Kits 重新安装不会覆盖它。
 */
@import "${base}/${entry}";
`,
    });
  }

  if (asset.type === "component") {
    const name = asset.name ?? asset.id;
    files.push({
      relPath: `${asset.id}.tsx`,
      content: `${BANNER(asset.id, asset.version)}"use client";
/* 组件源码自己引入它的结构样式，因此产品不需要单独 import CSS。 */

export {
  ${name},
  ${name} as default,
  type ${name}Props,
} from "${base}/index";
`,
    });
  }

  return files;
}

/**
 * 生成 adapters/index.ts 桶文件 + README。
 * 桶文件同样遵守「已存在则保留」。
 */
export function adapterScaffold() {
  return [
    {
      relPath: "README.md",
      content: `# adapters/ —— 产品托管区

这个目录属于**产品**，不属于 Kits。

\`\`\`
lib/kits/
├── installed/         Kits 托管区（只读，重新安装会覆盖）
├── adapters/          ← 你在这里（Kits 永不覆盖）
└── kits.lock.json     安装清单（Kits 托管）
\`\`\`

## 为什么要有这一层

Kits 的契约规定：**产品代码不得直接依赖组件 API**，因为组件实现随时
可能被替换。链路是：

\`\`\`
Kits 组件 → adapters/（你的稳定 API） → 产品代码
\`\`\`

产品只 import \`@/lib/kits/adapters/<asset>\`。升级 Kits 时托管区被覆盖，
而你的适配层与调用方一行不改。

## 你可以在这里做什么

- 覆盖品牌色（只允许颜色，见 \`style-*.css\` 里的注释）
- 把组件包成自己的产品语义（例如 \`<RunwayStage tone="brand" />\`）
- 强制关闭动效、替换实现、加测试友好的 testid

## 不要做什么

- 不要直接 import \`../installed/\`（那是托管区，会被覆盖）
- 不要把 Kits 的源码复制进这个目录（用 \`kits add\` 安装到 installed/）

## 重新生成

\`kits add\` 只在文件**不存在**时生成适配层。删掉某个文件再跑一次即可重新生成，
但你已经改过的文件永远不会被覆盖。
`,
    },
  ];
}

/**
 * 把适配层写入产品。
 *
 * @returns {{ written: string[], kept: string[] }}
 */
export function writeAdapters({ productRoot, layout = DEFAULT_LAYOUT, assets }) {
  const adapterRoot = path.join(productRoot, layout.adapterRoot);
  mkdirSync(adapterRoot, { recursive: true });

  const written = [];
  const kept = [];

  const emit = (relPath, content) => {
    const abs = path.join(adapterRoot, relPath);
    if (existsSync(abs)) {
      kept.push(`${layout.adapterRoot}/${relPath}`);
      return;
    }
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
    written.push(`${layout.adapterRoot}/${relPath}`);
  };

  for (const asset of assets) {
    for (const file of adapterFilesFor(asset)) {
      emit(file.relPath, file.content);
    }
  }
  for (const file of adapterScaffold()) {
    emit(file.relPath, file.content);
  }

  return { written, kept };
}
