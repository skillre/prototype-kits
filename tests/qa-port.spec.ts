/**
 * QA 端口事实与「不复用未知 server」的静态审计。
 *
 * ===========================================================================
 * 这组测试的存在理由
 * ===========================================================================
 * 端口冲突在这里不是「慢一点」，而是**静默的错误结论**：就绪探针只判断
 * 「有东西以 2xx/3xx 应答」，不判断「是不是这个应用」。Kits 原先与 starter / s1
 * 三仓共用 3200，于是任意两个同时运行时，整套断言都可能在**别人的页面**上变绿，
 * 而且不报错。
 *
 * 迁移到 3300 只解决了「抢同一号」，没有解决「接到陌生人」。后者要的是：
 *
 *   1. 端口事实只有**一个来源**（`.qa/qa.config.mjs`），而不是四个地方各写一遍；
 *   2. QA 入口**自己起 server**，并且起完**先验身份再断言**；
 *   3. 端口被占用时 fail loudly，而不是 adopt。
 *
 * 下面把这三条钉成断言。它们全是静态审计（读文件、解析 JSON），与仓库里其它
 * `tests/**` 一致 —— 这里的价值是「下一个人改回来时会红」，不是运行时行为。
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

/** 端口事实被声明在哪些文件里。必须与 factory-policy.json 的 kitsRegistry.portSurfaces 一致。 */
const DECLARED_PORT_SURFACES = [
  ".qa/qa.config.mjs",
  ".qa/kits-shots.mjs",
  ".qa/reveal-probe.mjs",
  "playground/package.json",
  "README.md",
];

/** 已退役的端口。它由三个仓共用，任何声明面上再出现它就是两个答案。 */
const RETIRED_PORT = 3200;

const QA_CONFIG = ".qa/qa.config.mjs";
const QA_ENTRY_POINTS = [".qa/kits-shots.mjs", ".qa/reveal-probe.mjs"];

const readText = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const readJson = <T>(rel: string) => JSON.parse(readText(rel)) as T;

/** 只取本测试真正要核的字段：其余形状由 `pnpm factory:agents` 的 schema 校验负责。 */
type PolicyShape = {
  concurrency: { qaPort: number };
  kitsRegistry: { portSurfaces: string[] };
};
type PackageShape = { scripts: Record<string, string> };

/** 某个整数是否作为**独立数字**出现在文本里（避免 13200 / 33000 这类误命中）。 */
const containsPort = (text: string, port: number) =>
  new RegExp(`(?<!\\d)${port}(?!\\d)`).test(text);

const policy = readJson<PolicyShape>("factory-policy.json");
const livePort = policy.concurrency.qaPort;
const qaConfigText = readText(QA_CONFIG);

describe("QA 端口事实", () => {
  it("策略把端口钉成一个整数，并且是迁移后的槽位", () => {
    expect(Number.isInteger(livePort)).toBe(true);
    expect(livePort).toBe(3300);
  });

  it("端口的唯一来源在 .qa/qa.config.mjs 里**声明**它（不只是注释里提一句）", () => {
    expect(qaConfigText).toMatch(new RegExp(`QA_PORT\\s*=\\s*${livePort}\\b`));
  });

  it("playground 的 dev 与 start 都用同一个端口", () => {
    const playground = readJson<PackageShape>("playground/package.json");
    for (const script of ["dev", "start"]) {
      const command = String(playground.scripts[script]);
      expect(command, `${script} 应显式钉住端口`).toContain(`-p ${livePort}`);
    }
  });

  it("声明的端口事实文件里不再出现已退役的端口", () => {
    const offenders = DECLARED_PORT_SURFACES.filter(
      (rel) => existsSync(path.join(ROOT, rel)) && containsPort(readText(rel), RETIRED_PORT),
    );
    expect(offenders, `这些文件仍写着旧端口 ${RETIRED_PORT}`).toEqual([]);
  });

  it("声明的端口事实文件仍然写出当前端口（否则事实与真实值脱节）", () => {
    const stating = DECLARED_PORT_SURFACES.filter(
      (rel) => existsSync(path.join(ROOT, rel)) && containsPort(readText(rel), livePort),
    );
    // config + playground + README 至少三处：来源、命令、对外文档。
    expect(stating.length).toBeGreaterThanOrEqual(3);
    expect(stating).toContain(QA_CONFIG);
    expect(stating).toContain("playground/package.json");
    expect(stating).toContain("README.md");
  });

  it("策略声明的 portSurfaces 与本测试的清单一致（两处清单不能各自漂移）", () => {
    expect([...policy.kitsRegistry.portSurfaces].sort()).toEqual([...DECLARED_PORT_SURFACES].sort());
  });
});

describe("QA 不复用未知 server", () => {
  it("QA 入口自己起 server：都经过 qa-server.mjs，而不是直接 page.goto 一个裸地址", () => {
    for (const rel of QA_ENTRY_POINTS) {
      const text = readText(rel);
      expect(text, `${rel} 必须走受管的 server 生命周期`).toContain("withQaServer");
      expect(text, `${rel} 必须从 qa.config.mjs 取端口`).toContain('from "./qa.config.mjs"');
    }
  });

  it("QA 入口不再硬编码 localhost 默认地址（那是「接到谁算谁」的写法）", () => {
    for (const rel of QA_ENTRY_POINTS) {
      const text = readText(rel);
      expect(text, `${rel} 仍在硬编码默认 BASE 地址`).not.toMatch(/http:\/\/localhost:\d+/);
    }
  });

  it("受管 server 在每个入口都做身份检查，而不只是等端口就绪", () => {
    const serverText = readText(".qa/qa-server.mjs");
    expect(serverText).toContain("verifyIdentity");
    expect(serverText).toContain("IDENTITY_PROBE");
    // 身份检查必须由起 server 的那条路径调用，而不是只被导出。
    expect(serverText).toMatch(/const identity = await verifyIdentity\(QA_ORIGIN\)/);
  });

  it("端口被占用时 fail loudly，且不替人杀进程", () => {
    const serverText = readText(".qa/qa-server.mjs");
    expect(serverText).toMatch(/已被占用/);
    expect(serverText).toContain("lsof -nP -iTCP:");

    const guardText = readText("scripts/check-qa-port.mjs");
    expect(guardText).toMatch(/process\.exit\(1\)/);
    /*
     * 守卫只报告，不清理：杀一个不认识的进程等于破坏别人的工作。
     *
     * 判据是「**调用**了 kill」，不是「提到了 kill」—— 守卫的文案里明确警告不要用
     * `pkill`，那句警告必须留着，把关键词本身判红只会教人删掉警告。所以这里查的是
     * 真正的执行形态：`process.kill(...)` 与行首的 kill/pkill 命令行。
     */
    expect(guardText).not.toContain("process.kill(");
    expect(guardText).not.toMatch(/^\s*(sudo\s+)?(pkill|kill)\b/m);
  });

  it("只停止本次运行自己启动的进程组（kill 负 pid），不是按名字杀", () => {
    const serverText = readText(".qa/qa-server.mjs");
    expect(serverText).toContain("detached: true");
    expect(serverText).toMatch(/process\.kill\(-child\.pid/);
  });

  it("package.json 的 qa 先跑端口守卫", () => {
    const pkg = readJson<PackageShape>("package.json");
    const qa = String(pkg.scripts.qa);
    expect(qa).toContain("check-qa-port.mjs");
    expect(qa.indexOf("check-qa-port.mjs")).toBeLessThan(qa.indexOf("kits-shots.mjs"));
  });
});
