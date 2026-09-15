/**
 * Prototype Kits · QA 端口与 Playground server 的唯一来源。
 *
 * 为什么要有这个文件
 * ------------------
 * 在这次迁移之前，「Kits 用哪个端口」这件事散在四处：`playground/package.json`
 * 的 dev/start、`.qa/kits-shots.mjs` 的默认值、`.qa/reveal-probe.mjs` 的默认值，
 * 以及 README。四个地方各写一遍，就必然有一个先过期——而过期的那一个恰好是
 * 「QA 打谁」的时候，整套断言会在**别的 server** 上通过，且不报错。
 *
 * 所以端口在这里声明一次，其余全部从这里 import。`pnpm factory:agents` 会核
 * 这件事：`QA_PORT` 必须等于 `factory-policy.json` 里钉住的 `concurrency.qaPort`。
 *
 * 端口为什么是 3300（而不是 Next 的默认端口，也不是 Kits 原来的槽位）
 * ---------------------------------------------------------------------
 * - **不是 3000**：那是 Next 的默认端口，同机任何一个残留的 `next dev` 都能占住它。
 * - **不是原来的槽位**：Kits 原先与 starter / s1 共用一个端口。Kits 是 Playground，
 *   不是业务原型，按根控制面 `catalog/ports.json` 的 advisory 让到独立槽位 3300，
 *   从此不与任何原型互撞。迁移记录见 `CHANGELOG.md`。
 *
 * 旧端口号**故意不出现在本文件里**：`.qa/qa.config.mjs` 是端口事实的**唯一来源**，
 * 它只需要说清「现在是哪个」；同时写上新旧两个号，就会让「Kits 用哪个端口」重新变成
 * 两个答案。`pnpm factory:agents` 的 port/retired-fact 会核这件事。
 *
 * 端口是**独占资源**：两个 run 同时钉在同一个端口上，不是「慢一点」，是其中一套
 * 断言打在别人的页面上。
 *
 * 本文件被以下消费者 import：
 *   - `.qa/qa-server.mjs`    QA server 生命周期（起、等、验身份、停）
 *   - `.qa/kits-shots.mjs`   截图与探针
 *   - `.qa/reveal-probe.mjs` 步进链路活体检查
 *   - `scripts/check-qa-port.mjs` 预检守卫
 */

/**
 * QA / Playground 独占端口。
 *
 * 显式钉住，不交给 Next 自动 +1：自动递增正是「测试 run 悄悄连到另一个
 * server」的实现方式。
 */
export const QA_PORT = 3300

/** QA server 绑定的地址。绑 127.0.0.1 而不是 0.0.0.0，避免把 dev server 暴露出去。 */
export const QA_HOST = "127.0.0.1"

/** 完整 origin，作为 Playwright 的 baseURL。 */
export const QA_ORIGIN = `http://${QA_HOST}:${QA_PORT}`

/**
 * Playground 的 workspace 过滤名。
 *
 * server 由 QA run 自己启动（见 `.qa/qa-server.mjs`），直接调用 `next dev` 并显式
 * 传入 `-p <QA_PORT>`，而不是走 playground 的 `dev` 脚本再追加参数：脚本里已经
 * 有一份 `-p`，追加会得到两个互相矛盾的端口参数，而「哪个生效」不该是运气问题。
 */
export const PLAYGROUND_FILTER = "@kits/playground"

/** 启动 Playground server 的命令与参数（唯一一处）。 */
export const SERVER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze([
    "--filter",
    PLAYGROUND_FILTER,
    "exec",
    "next",
    "dev",
    "-H",
    QA_HOST,
    "-p",
    String(QA_PORT),
  ]),
})

/**
 * 身份指纹 —— 「这个 server 是不是 Kits Playground」。
 *
 * 为什么需要它：一个 readiness 探针只判断「有东西以 2xx 应答」，不判断
 * 「是不是这个应用」。同机跑着多个原型，复用命中别的 server 会让整套断言在
 * 错误的页面上变绿，而且**不报错**。
 *
 * 这三个标记是 Playground 自己的产出，不是通用 HTML 里能碰巧出现的东西：
 *   - `data-kits-pack`       三套 Style Pack 的舞台标记
 *   - `data-kits-component`  Signature Component 的实例标记
 *   - `data-kits-*`          只在 Kits 的 playground app 里生成
 *
 * 身份检查在**每个 QA 入口**都跑一次，且是在起完 server、跑任何断言之前。
 */
export const IDENTITY_PROBE = Object.freeze({
  path: "/",
  /** 全部必须出现；少一个就不是 Kits Playground。 */
  requiredMarkers: Object.freeze(["data-kits-pack", "data-kits-component"]),
  /** 至少出现一个即可的部分指纹，用于报错时说明「这看起来像什么」。 */
  softMarkers: Object.freeze(["Style Packs", "Signature Components"]),
})

/** README / 文档里对外承诺的 Playground 地址。 */
export const DOCUMENTED_PLAYGROUND_URL = `http://localhost:${QA_PORT}`
