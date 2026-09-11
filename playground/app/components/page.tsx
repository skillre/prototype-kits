import heroManifest from "@kits/interactive-hero/manifest.json";
import spotlightManifest from "@kits/spotlight-surface/manifest.json";
import gridManifest from "@kits/animated-grid/manifest.json";
import cursorManifest from "@kits/data-cursor/manifest.json";
import revealManifest from "@kits/insight-reveal/manifest.json";

import { PackColumn } from "../../components/pack-stage";
import {
  CursorSample,
  GridSample,
  HeroSample,
  RevealSample,
  SpotlightSample,
} from "../../components/samples";

/**
 * /components —— 五个 Signature Component 的验收页。
 *
 * 这一页回答三个问题：
 *   1. 每个组件的**内部稳定 API** 是什么？（产品只允许用这些）
 *   2. 降级矩阵是否完整？（mobile / reduced-motion / SSR / 性能分级）
 *   3. 同一份调用在三种 pack 下是否都成立？
 */

const MANIFESTS = [
  heroManifest,
  spotlightManifest,
  gridManifest,
  cursorManifest,
  revealManifest,
];

type Manifest = (typeof MANIFESTS)[number];

function usedBy(pack: "editorial" | "cinematic" | "instrument", manifest: Manifest) {
  const table = manifest.usedByStylePacks as Record<string, string>;
  return table[pack] ?? "—";
}

export const metadata = {
  title: "Signature Components · Prototype Kits Playground",
};

export default function ComponentsPage() {
  return (
    <>
      <h1 className="pg-title">Signature Components · 验收</h1>
      <p className="pg-lede">
        五个组件的内部 API 都是<span>稳定契约</span>：
        产品只表达产品语义（tone / intensity / depth / step），
        不表达视觉字面量。视觉全部来自 Style Pack，降级全部内建。
      </p>

      <div className="pg-note">
        <strong>链路：</strong>
        {" 外部资产 → inspect → license/source check → dependency audit → "}
        {"compatibility audit → normalize → "}
        <strong>adapter</strong>
        {" → fallback → demo → test → experimental → approved"}
        <br />
        产品只能调用 adapter 之后的内部 API。第三方组件的 prop
        （<code>glowColor</code> / <code>blurRadius</code> / <code>speed</code>…）
        <strong>不允许</strong>出现在产品代码里。
      </div>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">契约矩阵（来自各组件 manifest.json）</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="pg-table">
            <thead>
              <tr>
                <th>组件</th>
                <th>API</th>
                <th>状态</th>
                <th>性能</th>
                <th>SSR</th>
                <th>Mobile 降级</th>
                <th>Reduced-motion</th>
                <th>第三方运行时</th>
                <th>editorial</th>
                <th>cinematic</th>
                <th>instrument</th>
              </tr>
            </thead>
            <tbody>
              {MANIFESTS.map((manifest) => (
                <tr key={manifest.id}>
                  <td>
                    <code>{manifest.id}</code>
                  </td>
                  <td>{manifest.apiVersion}</td>
                  <td>
                    <span className={`pg-pill pg-pill--${manifest.status}`}>
                      {manifest.status}
                    </span>
                  </td>
                  <td>{manifest.performance.classification}</td>
                  <td>{manifest.ssrCompatible ? "✅" : "—"}</td>
                  <td>{manifest.mobileCompatible ? "✅ 内建" : "—"}</td>
                  <td>
                    {manifest.reducedMotion ? manifest.reducedMotion.mechanism.slice(0, 22) : "—"}
                  </td>
                  <td>
                    {manifest.thirdPartyRuntime === "none" ? "none" : manifest.thirdPartyRuntime}
                  </td>
                  <td>{usedBy("editorial", manifest)}</td>
                  <td>{usedBy("cinematic", manifest)}</td>
                  <td>{usedBy("instrument", manifest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {MANIFESTS.map((manifest) => (
        <section className="pg-section" key={manifest.id} id={manifest.id}>
          <h2 className="pg-section__title">
            {manifest.name} · {manifest.id}
          </h2>
          <p className="pg-lede">{manifest.summary}</p>

          <div className="pg-matrix">
            <div className="pg-card">
              <h3>内部稳定 API</h3>
              <dl className="pg-kv">
                <dt>component</dt>
                <dd>{manifest.internalApi.component}</dd>
                {Object.entries(manifest.internalApi.props).map(([name, spec]) => (
                  <FragmentRow key={name} name={name} spec={spec as Record<string, unknown>} />
                ))}
              </dl>
            </div>

            <div className="pg-card">
              <h3>明确不暴露</h3>
              <ul className="pg-kv" style={{ display: "block", paddingLeft: 16 }}>
                {manifest.internalApi.explicitlyNotExposed.map((item) => (
                  <li key={item}>
                    <code>{item}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pg-card">
              <h3>降级与兼容</h3>
              <dl className="pg-kv">
                <dt>performance</dt>
                <dd>
                  {manifest.performance.classification} ·{" "}
                  {String(manifest.bundleSize)}
                </dd>
                <dt>ssr</dt>
                <dd>{manifest.ssrCompatible ? "兼容" : "—"}</dd>
                <dt>mobile fallback</dt>
                <dd>
                  {manifest.mobileCompatible && manifest.mobileFallback
                    ? manifest.mobileFallback.trigger
                    : "—"}
                </dd>
                <dt>no content loss</dt>
                <dd>
                  {manifest.mobileCompatible && manifest.mobileFallback
                    ? String(manifest.mobileFallback.noContentLoss)
                    : "—"}
                </dd>
                <dt>reduced-motion</dt>
                <dd>{manifest.reducedMotion?.mechanism}</dd>
              </dl>
            </div>

            <div className="pg-card">
              <h3>Adapter 要求</h3>
              <dl className="pg-kv">
                <dt>required</dt>
                <dd>{String(manifest.adapter.required)}</dd>
                <dt>实现</dt>
                <dd>{manifest.adapter.currentImplementation}</dd>
                <dt>第三方源码</dt>
                <dd>
                  {String(
                    (manifest.source as { containsThirdPartyCode?: boolean })
                      .containsThirdPartyCode ?? false,
                  )}
                </dd>
                <dt>example</dt>
                <dd>
                  <code>{manifest.internalApi.example}</code>
                </dd>
              </dl>
            </div>
          </div>
        </section>
      ))}

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          同一份调用 × 三种 Pack（五个组件全部并排）
        </h2>

        {(
          [
            ["InteractiveHero", HeroSample],
            ["SpotlightSurface", SpotlightSample],
            ["AnimatedGrid", () => <GridSample motion="pulse" />],
            ["DataCursor", CursorSample],
            ["InsightReveal", RevealSample],
          ] as const
        ).map(([label, Sample]) => (
          <div key={label} style={{ marginBottom: 32 }}>
            <h3 className="pg-section__title">{label}</h3>
            <div className="pg-grid pg-grid--3">
              <PackColumn pack="editorial">
                <div className="pg-inner">
                  <Sample />
                </div>
              </PackColumn>
              <PackColumn pack="cinematic">
                <div className="pg-inner">
                  <Sample />
                </div>
              </PackColumn>
              <PackColumn pack="instrument">
                <div className="pg-inner">
                  <Sample />
                </div>
              </PackColumn>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function FragmentRow({
  name,
  spec,
}: {
  name: string;
  spec: Record<string, unknown>;
}) {
  return (
    <>
      <dt>{name}</dt>
      <dd>
        <code>{String(spec.type)}</code>
        {spec.default !== undefined ? ` = ${String(spec.default)}` : ""}
        {spec.required ? " (必填)" : ""}
      </dd>
    </>
  );
}
