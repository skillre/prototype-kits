#!/usr/bin/env node
/**
 * Pre-flight QA port guard  ·  Prototype Kits
 *
 * WHY THIS EXISTS
 * ---------------
 * A readiness probe that only asks "does something answer with 2xx/3xx?" performs
 * **no identity check at all**. A stale dev server, or another prototype on the
 * same port, therefore becomes "the app under test", and the entire suite can go
 * green against the wrong page. That is not a theoretical hazard on this machine:
 * 3200 used to be shared by starter, s1 and kits at the same time, and this guard
 * exists so that a run can never quietly attach to a stranger.
 *
 * Three independent defences, because any one alone is insufficient:
 *   1. this guard — fail *before* Chromium launches, naming the port and how to
 *      find its owner, instead of a confusing timeout;
 *   2. `.qa/qa-server.mjs` — never adopt: the QA server is spawned by the run
 *      that uses it, and the script refuses if the port is already taken;
 *   3. `IDENTITY_PROBE` in `.qa/qa.config.mjs` — after the server is up, the
 *      response must actually carry Kits' own markers.
 *
 * It refuses to guess and it kills nothing: killing an unknown process is how you
 * take down somebody else's work. It reports and exits non-zero.
 *
 * Usage: `node scripts/check-qa-port.mjs [port]`
 */

import { createConnection } from "node:net"

import { QA_HOST, QA_PORT } from "../.qa/qa.config.mjs"

const port = Number(process.argv[2] ?? QA_PORT)

/** Attempt one TCP connection. Resolves true when something is listening. */
function isPortInUse(host, candidatePort) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: candidatePort })
    const settle = (inUse) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(inUse)
    }
    socket.setTimeout(700)
    socket.once("connect", () => settle(true))
    socket.once("timeout", () => settle(false))
    socket.once("error", () => settle(false))
  })
}

const inUse = await isPortInUse(QA_HOST, port)

if (inUse) {
  const lines = [
    "",
    `\u001b[1mQA 端口被占用：${QA_HOST}:${port}\u001b[0m`,
    "",
    "QA 必须由当前 run 自己启动 server，绝不复用已经存在的进程：",
    "就绪探针只判断「有东西应答」，不判断「是不是这个应用」，",
    "一旦复用命中别的 server，整套断言会在错误的页面上通过。",
    "",
    "所以这里选择 fail loudly，而不是替你猜。请先确认这个端口上是什么，再决定是否停止它：",
    "",
    `  lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    "",
    '不要使用 `pkill -f "next dev"` / `pkill -f "next-server"` —— 那会杀掉同机其它原型，',
    "甚至你自己的开发服务器。只停止你确认属于当前任务的那一个进程。",
    "",
    "换一个端口：改 .qa/qa.config.mjs 的 QA_PORT（并同步 factory-policy.json 的",
    `concurrency.qaPort，否则 pnpm factory:agents 会拦下这次不一致），或临时：`,
    `  node scripts/check-qa-port.mjs ${port + 1}`,
    "",
  ]
  process.stderr.write(lines.join("\n"))
  process.exit(1)
}

process.stdout.write(`\u001b[32m✓\u001b[0m QA 端口可用 ${QA_HOST}:${port}\n`)
process.exit(0)
