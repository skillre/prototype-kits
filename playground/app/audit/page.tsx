import assets from "../../../registry/assets.json";
import {
  PACK_VIEWS,
  PROFILE_DIMENSIONS,
} from "../../components/registry-view";

/**
 * /audit —— Asset Registry 与契约审计页。
 *
 * 这一页回答：
 *   1. 三套 pack 在十个维度上是否**真的不同**（逐维度对照）
 *   2. motion 契约的差异（时长/角色/降级）
 *   3. registry/assets.json 里有什么、状态如何
 *   4. Incoming Workflow 的完整链路
 */

export const metadata = {
  title: "Asset Registry · Prototype Kits Playground",
};

const INCOMING_STEPS = [
  "incoming",
  "inspect",
  "license / source check",
  "dependency audit",
  "compatibility audit",
  "normalize",
  "adapter",
  "fallback",
  "demo",
  "test",
  "experimental",
  "approved",
];

export default function AuditPage() {
  const byType = (type: string) =>
    assets.assets.filter((asset) => asset.type === type);

  return (
    <>
      <h1 className="pg-title">Asset Registry · 审计</h1>
      <p className="pg-lede">
        资产库成立的前提不是「东西多」，而是**可追溯、可审计、可替换**。
        这一页把三套风格的真实差异、动效契约、登记表与准入流程摊开来看。
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          01 · 十个维度对照（契约要求：必须明显不同）
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="pg-table">
            <thead>
              <tr>
                <th>维度</th>
                {PACK_VIEWS.map((pack) => (
                  <th key={pack.id}>{pack.label}</th>
                ))}
                <th>是否不同</th>
              </tr>
            </thead>
            <tbody>
              {PROFILE_DIMENSIONS.map((dimension) => {
                const values = PACK_VIEWS.map(
                  (pack) => pack.profile[dimension.key],
                );
                const distinct = new Set(values).size;
                return (
                  <tr key={String(dimension.key)}>
                    <td>
                      {dimension.label}
                      <br />
                      <span style={{ opacity: 0.6 }}>{dimension.hint}</span>
                    </td>
                    {values.map((value, index) => (
                      <td key={PACK_VIEWS[index].id}>
                        <code>{String(value)}</code>
                      </td>
                    ))}
                    <td>
                      {distinct === 3
                        ? "✅ 三套全不同"
                        : distinct === 2
                          ? "⚠️ 两套相同"
                          : "❌ 完全相同"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="pg-note">
          这张表由 `styles/*/index.ts` 导出的 `profile` 直接渲染 ——
          而 `profile` 又必须与各自的 `manifest.json` 一致，由 `tests/contracts.spec.ts` 强制。
          也就是说：**文档不可能与实现漂移**。
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">02 · Motion 契约对照</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="pg-table">
            <thead>
              <tr>
                <th>pack</th>
                <th>语言</th>
                <th>角色</th>
                <th>时长区间</th>
                <th>ambient 周期</th>
                <th>进入位移</th>
                <th>指针因子</th>
                <th>reduced-motion 保留淡入</th>
                <th>移动端指针</th>
              </tr>
            </thead>
            <tbody>
              {PACK_VIEWS.map((pack) => {
                const motion = pack.motion;
                const durations = Object.values(motion.duration);
                return (
                  <tr key={pack.id}>
                    <td>
                      <code>{pack.id}</code>
                    </td>
                    <td>{motion.language}</td>
                    <td>{motion.roles.join(" / ")}</td>
                    <td>
                      {Math.min(...durations)}–{Math.max(...durations)}ms
                    </td>
                    <td>{motion.ambientCycle}ms</td>
                    <td>
                      <code>{motion.enterDistance}</code>
                    </td>
                    <td>{motion.pointerFactor}</td>
                    <td>{motion.reducedMotion.keepOpacity ? "是" : "否（瞬时可见）"}</td>
                    <td>{motion.mobile.pointer ? "开" : "关"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="pg-note">
          三处刻意的差异：<strong>instrument 没有 ambient 角色</strong>（仪表不呼吸）、
          <strong>instrument 不保留淡入</strong>（告警必须瞬时可见）、
          <strong>editorial 的指针因子只有 0.15</strong>（纸不会自己动）。
          这些都不是 bug，是 pack 语义。
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          03 · registry/assets.json（{assets.assets.length} 条）
        </h2>
        <div className="pg-matrix" style={{ marginBottom: 20 }}>
          {(["style", "component", "effect", "skill"] as const).map((type) => (
            <div className="pg-card" key={type}>
              <h3>{type}</h3>
              <dl className="pg-kv">
                <dt>数量</dt>
                <dd>{byType(type).length}</dd>
                <dt>状态</dt>
                <dd>
                  {Array.from(new Set(byType(type).map((a) => a.status))).join(
                    " / ",
                  )}
                </dd>
                <dt>性能分级</dt>
                <dd>
                  {Array.from(
                    new Set(byType(type).map((a) => String(a.performance))),
                  ).join(" / ")}
                </dd>
              </dl>
            </div>
          ))}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="pg-table">
            <thead>
              <tr>
                <th>id</th>
                <th>type</th>
                <th>status</th>
                <th>version</th>
                <th>deps</th>
                <th>perf</th>
                <th>SSR</th>
                <th>mobile</th>
                <th>reduced-motion</th>
                <th>source</th>
              </tr>
            </thead>
            <tbody>
              {assets.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <code>{asset.id}</code>
                  </td>
                  <td>{asset.type}</td>
                  <td>
                    <span className={`pg-pill pg-pill--${asset.status}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td>{asset.version}</td>
                  <td>
                    {asset.dependencies.length === 0
                      ? "0"
                      : asset.dependencies.length}
                  </td>
                  <td>{String(asset.performance)}</td>
                  <td>{asset.ssrCompatible === true ? "✅" : String(asset.ssrCompatible)}</td>
                  <td>
                    {asset.mobileCompatible === true
                      ? "✅"
                      : String(asset.mobileCompatible)}
                  </td>
                  <td>{asset.reducedMotion}</td>
                  <td>
                    {asset.source.kind}
                    {asset.source.containsThirdPartyCode ? " ⚠️ 含第三方" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">04 · Incoming Workflow（外部资产准入）</h2>
        <ol className="pg-flow">
          {INCOMING_STEPS.map((step, index) => (
            <li
              key={step}
              data-state={index < INCOMING_STEPS.length - 2 ? "done" : undefined}
            >
              {index + 1}. {step}
            </li>
          ))}
        </ol>

        <p className="pg-note">
          任何外部资产（UI 组件、动效、Shader、Dashboard、Skill、Design System、
          Landing Page、React Component）<strong>都不能直接进入 Prototype 或 Factory</strong>。
          必须先落到 <code>incoming/</code>，走完上面这条链路。
        </p>

        <div className="pg-matrix">
          <div className="pg-card">
            <h3>禁止</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {assets.policy.forbidden.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="pg-card">
            <h3>approved 的门槛</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {assets.policy.approvalRequired.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
