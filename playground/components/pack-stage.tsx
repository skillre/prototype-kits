import type { ReactNode } from "react";

import { PACK_VIEWS } from "./registry-view";

/**
 * PackStage —— Playground 的"风格舞台"。
 *
 * 这是整个 Playground 唯一一处给元素加 `data-kits-pack` 的地方。
 * 产品里的做法完全一样：
 *
 *     <PackStage pack="cinematic">…</PackStage>
 *     ≡
 *     <section data-kits-pack="cinematic">…</section>
 *
 * 舞台上的一切（排版/间距/圆角/边界/表面/动效）都由该 pack 决定；
 * 舞台内部的组件调用在**每一套** pack 下完全相同。
 *
 * **名单来自 registry**（`registry/assets.json` 里 `type === "style"` 且
 * `status === "approved"` 的资产，见 `registry-view.ts`）。这个文件里
 * 不写死 pack id，也不写死 pack 数量 —— K1 的第四套 pack `console`
 * 之所以在本仓从没上过屏，正是因为这里曾经写着三个字面量。
 */

/** 已批准 pack 的 id 列表，顺序即 registry 顺序。 */
export const PACK_IDS: string[] = PACK_VIEWS.map((pack) => pack.id);

export type PackId = string;

/**
 * 舞台标题用的显示名：直接取 registry 的 `name`。
 *
 * registry 没写 `name` 时退回 id（而不是退回空字符串）：一块没有名字的
 * 舞台会让人以为「这里没有 pack」，而事实是「登记不完整」。
 */
export function packLabel(pack: PackId): string {
  return PACK_VIEWS.find((view) => view.id === pack)?.label ?? pack;
}

/**
 * 每套 pack 的一句话性格 —— **人工撰写的说明**。
 *
 * 刻意的取舍：这一段不从 registry 生成。registry 回答「有哪些 pack」，
 * 不回答「这套 pack 的性格是什么」；把后者做成自动拼接，只会得到一句
 * 谁都不信的模板句。代价是**新增 pack 时它不会自动出现** —— 所以由
 * `tests/playground-pack-coverage.spec.ts` 把这件事变成红：少写一条就不通过，
 * 而不是在页面上留一块谁也看不见的空白。
 */
const PACK_SUMMARY: Record<string, string> = {
  editorial: "纸与字 · 大留白 · 强排版 · 极克制 motion",
  cinematic: "光与深度 · 环境光 · 玻璃表面 · 指针视差",
  instrument: "刻度与读数 · 高密度 · 硬边界 · 瞬时动效",
  console: "等宽即读数 · 列对齐 · 语义色纪律 · 事件驱动动效",
};

/** 说明缺失时的**显式**兜底文案：缺口要被看见，而不是被留白吞掉。 */
export const PACK_SUMMARY_FALLBACK =
  "（Playground 尚未为这套 pack 撰写说明 —— 这是视图缺口，不是 pack 缺陷）";

/** registry 里有、但还没写说明的 pack。正常状态是空数组。 */
export const MISSING_PACK_SUMMARY: string[] = PACK_IDS.filter(
  (id) => !PACK_SUMMARY[id],
);

/** cinematic 的舞台背景：把环境光做成舞台级背景，而不是给每个卡片加光。 */
const STAGE_BACKGROUND: Partial<Record<PackId, string>> = {
  cinematic: `radial-gradient(80% 60% at 15% 0%, rgb(79 214 255 / 0.14) 0%, transparent 60%),
     radial-gradient(60% 50% at 85% 10%, rgb(255 182 79 / 0.09) 0%, transparent 55%),
     var(--kits-color-canvas)`,
};

export function PackStage({
  pack,
  children,
  className,
}: {
  pack: PackId;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-kits-pack={pack}
      className={className}
      style={STAGE_BACKGROUND[pack] ? { background: STAGE_BACKGROUND[pack] } : undefined}
    >
      {children}
    </section>
  );
}

export function PackColumn({
  pack,
  note,
  children,
}: {
  pack: PackId;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="pg-column" data-pack-column={pack}>
      <div className="pg-column__head">
        <strong>{packLabel(pack)}</strong>
        <span>{note ?? PACK_SUMMARY[pack] ?? PACK_SUMMARY_FALLBACK}</span>
      </div>
      <PackStage pack={pack} className="pg-column__stage">
        {children}
      </PackStage>
    </div>
  );
}
