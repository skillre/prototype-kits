/**
 * Style Pack · cinematic · motion
 *
 * 动效语言：atmospheric（氛围）。
 *
 * 与 editorial 的 restrained 相比，三处关键差异：
 *   1. 位移更大（24px + 6px blur），因为要表达「从远处进入画面」；
 *   2. 时长更长（base 360ms、slow 720ms），因为空间感需要时间被感知；
 *   3. 指针视差因子 1（editorial 是 0.15），交互本身是这套风格的一部分。
 *
 * 但红线不变：交互动效 ≤ 1000ms；动画只服务四类角色。
 */

import type { StylePackMotion } from "@kits/contracts";

export const cinematicMotion: StylePackMotion = {
  language: "atmospheric",

  duration: {
    instant: 120,
    quick: 220,
    base: 360,
    slow: 720,
    ambient: 9000, // 环境光呼吸 9s
  },

  // 缓动：入场用长尾 ease-out（重物落定），交互用轻微回弹（材质感）
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.5, 0, 0.2, 1)",
    linear: "linear",
    spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
  },

  staggerStep: 110, // 逐层浮出：像镜头依次对焦
  ambientCycle: 9000,
  enterDistance: "24px",
  pointerFactor: 1, // 完整指针视差：hero 与 spotlight 都吃这个值

  // 四类角色全部授予 —— 但 ambient 必须有明确用途（环境光/网格），不得滥用
  roles: ["enter", "interact", "ambient", "data"],

  reducedMotion: {
    collapseTo: 0,
    keepOpacity: true, // 淡入保留：深色页面上直接切断会出现闪白
    keepColor: true,
    disableRoles: ["enter", "interact", "ambient", "data"],
  },

  mobile: {
    breakpoint: 768,
    pointer: false, // 触屏没有 hover，指针视差在移动端是噪音
    distanceScale: 0.5,
    ambient: false, // 关闭环境光动画：省电，且移动端 GPU 预算更紧
  },
};

export default cinematicMotion;
