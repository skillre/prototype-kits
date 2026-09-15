import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prototype Kits · Visual Playground",
  description:
    "Prototype Factory 的可插拔视觉与能力资产库 —— 三套 Style Pack、五个 Signature Component、Asset Registry 与 Incoming Workflow 的验收台。",
};

/**
 * Playground 外壳。
 *
 * 注意：外壳**不使用任何 Style Pack 变量** —— 它是中立的容器，
 * 这样三种风格才能在同一页里并排而互不污染。
 * `data-kits-pack` 只出现在每一列的舞台元素上。
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="pg-header">
          <div className="pg-brand">
            prototype-kits <span>· visual playground</span>
          </div>
          <nav className="pg-nav">
            <Link href="/">Style Packs 并排</Link>
            <Link href="/components">Signature Components</Link>
            <Link href="/effects">Effect Contract</Link>
            <Link href="/audit">Asset Registry</Link>
          </nav>
          <div className="pg-header__note">
            v0.2.0 · 验收台，不是业务产品
          </div>
        </header>
        <main className="pg-main">{children}</main>
      </body>
    </html>
  );
}
