/**
 * Prototype Kits · QA server 生命周期 —— 起、等、**验身份**、停。
 *
 * 立场（Factory v1.1 的教训）
 * --------------------------
 * 一个「有东西以 2xx 应答就算就绪」的探针，比没有探针更危险：它会把残留的 dev
 * server、或者同机另一个原型，当成「被测应用」，让整套断言在**错误的页面**上
 * 变绿，而且不报错。
 *
 * 所以这里的规则是三条，缺一不可：
 *
 *   1. **不复用**。默认模式下端口被占用就 fail loudly，并给出定位命令——
 *      不 adopt、不猜、不替人杀进程。
 *   2. **自己起、自己停**。child 以 `detached: true` 起成独立**进程组**：
 *      `pnpm` 只是一层包装，只杀 `pnpm` 会把真正的 `next-server` 孙进程留成
 *      孤儿占着端口。杀进程组才是「只停自己起的东西」这句话的落地方式。
 *   3. **验身份**。server 起来之后、跑任何断言之前，必须确认应答页面真的是
 *      Kits Playground（`IDENTITY_PROBE` 的标记全部出现）。端口对不上、或者
 *      端口对了但页面不是它，都在这里停下。
 *
 * 显式外部模式
 * ------------
 * 设了 `KITS_BASE` 时，脚本**不会**起 server——这是有意为之：那种情况下
 * 目标是别处（例如一个预览部署）。但身份检查照跑：外部目标也必须证明自己是
 * Kits Playground。检查结果会被标注为 EXTERNAL，不会被说成「本次运行自己起的
 * server」。
 */

import { spawn } from "node:child_process"
import { createConnection } from "node:net"

import { IDENTITY_PROBE, QA_HOST, QA_ORIGIN, QA_PORT, SERVER_COMMAND } from "./qa.config.mjs"

function note(message) {
  process.stdout.write(`  \u001b[33m!\u001b[0m ${message}\n`)
}

export function isPortInUse(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
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

async function waitForResponse(origin, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { redirect: "manual" })
      if (response.status < 500) return response
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

/**
 * Identity check — is the thing at `origin` actually the Kits Playground?
 *
 * Not a liveness check. A liveness check passes for any server; this one fails
 * unless the page carries markers that only this playground emits.
 *
 * @returns {Promise<{ ok: boolean, reason?: string, markers?: string[] }>}
 */
export async function verifyIdentity(origin) {
  let response
  try {
    response = await fetch(`${origin}${IDENTITY_PROBE.path}`, { redirect: "manual" })
  } catch (error) {
    return { ok: false, reason: `请求 ${origin}${IDENTITY_PROBE.path} 失败：${error.message}` }
  }

  if (response.status >= 300) {
    return {
      ok: false,
      reason:
        `${origin}${IDENTITY_PROBE.path} 返回 HTTP ${response.status}` +
        (response.status === 401 || response.status === 403
          ? "（受保护或未授权——既不是「部署失败」，也不是「可用」）"
          : ""),
    }
  }

  const html = await response.text()
  const missing = IDENTITY_PROBE.requiredMarkers.filter((marker) => !html.includes(marker))
  if (missing.length > 0) {
    const soft = IDENTITY_PROBE.softMarkers.filter((marker) => html.includes(marker))
    return {
      ok: false,
      reason:
        `${origin} 应答了，但它不是 Kits Playground：缺少身份标记 ${missing.join(", ")}。` +
        (soft.length > 0 ? `（命中的弱标记：${soft.join(", ")}）` : "（一个弱标记都没命中）") +
        " —— 这个端口上很可能是别的 server。",
    }
  }

  return { ok: true, markers: [...IDENTITY_PROBE.requiredMarkers] }
}

/**
 * Start the Playground ourselves, then prove it is ours.
 *
 * @returns {Promise<{ child: import("node:child_process").ChildProcess, origin: string }>}
 */
async function startOwnServer(projectRoot) {
  if (await isPortInUse(QA_HOST, QA_PORT)) {
    throw new Error(
      `QA 端口 ${QA_HOST}:${QA_PORT} 已被占用。\n` +
        "  QA 不复用任何已存在的 server：一旦接到别的进程上，整套断言都会在错误的页面上通过。\n" +
        `  查看占用者：lsof -nP -iTCP:${QA_PORT} -sTCP:LISTEN\n` +
        "  确认那确实属于当前任务后再单独停止它。\n" +
        '  不要用 pkill -f "next dev" / pkill -f "next-server"（会误杀同机其它原型）。',
    )
  }

  const child = spawn(SERVER_COMMAND.command, [...SERVER_COMMAND.args], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    detached: true,
  })

  // Keep the server's own output: discarded on the happy path, but on a startup
  // failure it is the only thing that explains *why*. Printing it beats guessing.
  const serverOutput = []
  const capture = (chunk) => {
    serverOutput.push(chunk.toString())
    if (serverOutput.length > 200) serverOutput.shift()
  }
  child.stdout.on("data", capture)
  child.stderr.on("data", capture)

  const response = await waitForResponse(QA_ORIGIN)
  if (!response) {
    await stopOwnServer(child)
    throw new Error(
      `Playground server 未能在 ${QA_ORIGIN} 就绪。\n` +
        serverDiagnosis(serverOutput.join("")) +
        "  server 自己的输出（最后 40 行）：\n" +
        serverOutput
          .join("")
          .split("\n")
          .slice(-40)
          .map((line) => `    │ ${line}`)
          .join("\n"),
    )
  }

  const identity = await verifyIdentity(QA_ORIGIN)
  if (!identity.ok) {
    await stopOwnServer(child)
    throw new Error(
      `本次运行自己在 ${QA_ORIGIN} 起了 server，但它没有通过身份检查：${identity.reason}\n` +
        "  这可能意味着端口在启动过程中被别的进程抢走，或 Playground 的标记被改动。\n" +
        "  在查清楚之前，任何断言结果都不能算数。",
    )
  }

  return { child, origin: QA_ORIGIN, identity }
}

/**
 * Turn Next's most confusing startup failure into an actionable message.
 *
 * `next dev` takes a **per-project** singleton lock (`.next/dev/lock`), not a
 * per-port one. A second dev server for this project refuses to start *even on a
 * different port*; and if a previous server was killed uncleanly, its stale pid
 * keeps blocking every later run while the port looks perfectly free.
 */
function serverDiagnosis(output) {
  if (!/Another next dev server is already running/i.test(output)) return ""
  const pid = output.match(/- PID:\s+(\d+)/)?.[1]
  return (
    "  ⚠ Next 16 的 dev server 是**按项目**加锁的（playground/.next/dev/lock），不是按端口。\n" +
    "    同一个项目不能再起第二个 `next dev`，即使端口不同；而且上一次被强杀的服务\n" +
    "    会在 lock 里留下过期 pid，让之后每一次启动都失败——而端口看起来是空的。\n" +
    (pid ? `    定位到的 pid：${pid}。确认它属于本项目后再停止：kill -9 ${pid}\n` : "") +
    "    另外：`pnpm test` 与 `pnpm qa` 不能同时跑，它们抢同一个项目锁。\n"
  )
}

/** Stop only the process group this run started, then confirm the port is free. */
async function stopOwnServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const signal = (name) => {
    try {
      // Negative pid targets the whole group (we spawned detached).
      process.kill(-child.pid, name)
    } catch {
      try {
        child.kill(name)
      } catch {
        /* already gone */
      }
    }
  }
  signal("SIGTERM")
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (!(await isPortInUse(QA_HOST, QA_PORT))) {
      note(`QA server 已停止（pid ${child.pid} 进程组），端口 ${QA_PORT} 已释放`)
      return
    }
  }
  signal("SIGKILL")
  await new Promise((resolve) => setTimeout(resolve, 400))
  if (await isPortInUse(QA_HOST, QA_PORT)) {
    note(
      `QA server 可能未完全停止：端口 ${QA_PORT} 仍被占用（pid ${child.pid}）。` +
        "下次运行会由端口守卫拦下并给出定位命令。",
    )
  } else {
    note(`QA server 已在 SIGKILL 后停止（pid ${child.pid}）`)
  }
}

/**
 * Run `body(origin, mode)` with a verified Playground origin, and always clean up.
 *
 * @param {(origin: string, info: { mode: "LOCAL_MANAGED" | "EXTERNAL", identity: object }) => Promise<any>} body
 */
export async function withQaServer(body) {
  const projectRoot = process.cwd()
  const external = process.env.KITS_BASE

  if (external) {
    /**
     * Explicit external target. We deliberately do NOT spawn anything, and we do
     * NOT silently treat it as trustworthy: identity is still verified, and the
     * mode is reported as EXTERNAL so no reader mistakes this for a run that
     * managed its own server.
     */
    const origin = external.replace(/\/$/, "")
    const identity = await verifyIdentity(origin)
    if (!identity.ok) {
      throw new Error(
        `KITS_BASE=${external} 没有通过身份检查：${identity.reason}\n` +
          "  「有东西应答」不等于「那是 Kits Playground」。在查清楚之前不跑任何断言。",
      )
    }
    note(`KITS_BASE 已显式指定，本次运行**不**启动也不停止任何 server：${origin}（EXTERNAL）`)
    return { mode: "EXTERNAL", origin, result: await body(origin, { mode: "EXTERNAL", identity }) }
  }

  let child = null
  try {
    const started = await startOwnServer(projectRoot)
    child = started.child
    note(`Playground server 由本次运行启动（pid ${child.pid}，端口 ${QA_PORT}），身份检查已通过`)
    const result = await body(QA_ORIGIN, { mode: "LOCAL_MANAGED", identity: started.identity })
    return { mode: "LOCAL_MANAGED", origin: QA_ORIGIN, result }
  } finally {
    await stopOwnServer(child)
  }
}
