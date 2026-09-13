import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";

// 产品代码只 import 适配层 —— 见 app/page.tsx 的说明。
import { stylePackMotionVars } from "@/lib/kits/adapters/style-pack";

export const metadata: Metadata = { title: "Kits standalone fixture" };

/**
 * `data-kits-pack` 让 Style Pack 的作用域生效。
 *
 * 这一条**必须由产品自己声明**（Kits 不替产品决定 pack 用在哪），
 * 也是接入时唯一一处"无法被安装器自动化"的约定 —— 因为它表达的是
 * 产品语义（这一屏用哪套风格），不是机械替换。
 *
 * `stylePackMotionVars` 来自 `adapters/style-pack` —— 那是 pack 的 TS 缝。
 * 它内部调用的是**正式安装的**契约编译器 `motionToCssVars`，不是手抄的
 * 变量表；这在 v0.1.0 是做不到的（那时没有 TS 缝，产品只能直接 import
 * `lib/kits/installed/cinematic/index` 去越界，见 CHANGELOG K-04）。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      data-kits-pack="cinematic"
      style={stylePackMotionVars as CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
