import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Kits standalone fixture" };

/**
 * `data-kits-pack` 让 Style Pack 的作用域生效。
 *
 * 这一条**必须由产品自己声明**（Kits 不替产品决定 pack 用在哪），
 * 也是接入时唯一一处"无法被安装器自动化"的约定 —— 因为它表达的是
 * 产品语义（这一屏用哪套风格），不是机械替换。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-kits-pack="cinematic">
      <body>{children}</body>
    </html>
  );
}
