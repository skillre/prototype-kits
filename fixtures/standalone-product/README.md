# Standalone Fixture

> **这个目录是一个一次性验证装置，不是一个产品。**

它存在的唯一目的，是回答一个问题：

> **`kits add` 装完之后，把 prototype-kits 仓库整个删掉，产品还能不能活着？**

## 为什么需要它

第一版 Kits 的接入方式是 **Local Link**（`link:../prototype-kits/<pkg>`）。
那种方式下产品能跑，但它证明不了任何关于"交付"的事 ——
产品与 Kits 共享同一台机器的同一棵目录树，还共享同一份 React 类型。
第一次真实 Style Migration 的五个缺口，全部是这种耦合的产物。

这个 fixture 是**对照组**：它的 `package.json` 里没有任何 `@kits/*`
依赖，`next.config.ts` 里没有任何 Kits 相关配置。

## 它验证什么

`node scripts/verify-standalone.mjs` 会依次做：

1. 把本目录复制到一个临时位置（**不动仓库里的这份**）
2. 用 Kits 自己的 CLI 做一次 `kits add --style cinematic --components …`
3. 在临时产品里 `pnpm install`
4. **把 prototype-kits 仓库临时改名移走**（模拟"Kits 不存在"）
5. 在那种状态下跑 `tsc --noEmit` 与 `next build`
6. 把仓库改回来（`try/finally`，异常也会恢复）
7. 跑 `kits doctor`（此时 CLI 来自产品自己的 `lib/kits/.kits/`）

第 4 步是关键。少了它，整个测试退化成"在同一棵目录树里能跑"——
而那正是第一版被证伪的假设。

## 它不验证什么

- 视觉是否正确（那是 Playground 与 Browser QA 的事）
- 升级路径（`kits upgrade` 属于 v0.2，本版只有 `diff` 报告）
- 与 Tailwind / shadcn 等框架的共存（那是产品侧的事，见 docs/integration.md）

## 文件怎么来的

`lib/kits/installed/`、`lib/kits/adapters/`、`lib/kits/kits.lock.json`、
`lib/kits/.kits/` 全部由 `kits add` 生成，**不在版本控制里**。
仓库里只有 fixture 的骨架（app/ + 配置），因为那些才是"产品自己的东西"。
