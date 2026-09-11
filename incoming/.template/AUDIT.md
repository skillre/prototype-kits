# AUDIT · <资产名>

> 审计记录。每一项都要有**结论**，而不是"看起来没问题"。

## 1. Inspect

- 入口文件：
- 文件数 / 总行数：
- 是否含编译产物 / 混淆代码：

## 2. License / source check

- 许可证：见 `LICENSE`
- 来源可追溯：是 / 否
- 结论：

## 3. Dependency audit

| 依赖 | 版本 | 用途 | 可接受 |
|---|---|---|---|
| | | | |

- 传递依赖数量：
- 含原生模块（node-gyp / wasm）：
- 打包体积（gzip）：
- 结论：

## 4. Compatibility audit

| 项 | 结论 |
|---|---|
| SSR / Next.js App Router | |
| RSC（能否作为客户端叶子） | |
| 触屏 / 粗指针 | |
| reduced-motion | |
| 低端设备性能 | |
| 浏览器兼容 | |

## 5. Normalize 计划

<要剥掉什么：品牌视觉、多余 API、不必要的依赖>

## 6. Adapter 计划

| 我们的内部 API | 第三方的 prop | 备注 |
|---|---|---|
| tone | | 产品不传颜色 |
| intensity | | 产品不传数值 |

## 7. Fallback 计划

- mobile：
- reduced-motion：
- no-JS：

## 8. 结论

- [ ] 进入 normalize（分配组件 id：）
- [ ] 退回（原因）：
- [ ] 需要上游澄清（问题）：
