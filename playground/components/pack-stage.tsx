import type { ReactNode } from "react";

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
 * 舞台内部的组件调用在三种 pack 下**完全相同**。
 */

export const PACK_IDS = ["editorial", "cinematic", "instrument"] as const;
export type PackId = (typeof PACK_IDS)[number];

export const PACK_LABEL: Record<PackId, string> = {
  editorial: "Editorial",
  cinematic: "Cinematic",
  instrument: "Instrument",
};

export const PACK_SUMMARY: Record<PackId, string> = {
  editorial: "纸与字 · 大留白 · 强排版 · 极克制 motion",
  cinematic: "光与深度 · 环境光 · 玻璃表面 · 指针视差",
  instrument: "刻度与读数 · 高密度 · 硬边界 · 瞬时动效",
};

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
        <strong>{PACK_LABEL[pack]}</strong>
        <span>{note ?? PACK_SUMMARY[pack]}</span>
      </div>
      <PackStage pack={pack} className="pg-column__stage">
        {children}
      </PackStage>
    </div>
  );
}
