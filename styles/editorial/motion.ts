/**
 * Style Pack · editorial · motion
 *
 * 动效语言：restrained（克制）。
 *
 * 这一套的出发点是印刷品：纸不会自己动。因此：
 *   - 进入动效只用 10px 位移 + 极短时长，读者应感觉「它本来就在那」；
 *   - 没有环境动效（ambient 用 12s 只是为了给个别元素一个极慢的呼吸，
 *     且 roles 里根本不授予 ambient）；
 *   - 指针视差因子 0.15：几乎察觉不到，只在 hero 上提供一点点「页面是活的」；
 *   - reduced-motion 下 collapseTo = 0ms，完全静态 —— 因为 editorial 的
 *     信息全部在文字里，不依赖任何动画传达。
 */

import type { StylePackMotion } from "@kits/contracts";

export const editorialMotion: StylePackMotion = {
  language: "restrained",

  // 时长刻度：整体快，最长 480ms。交互动效绝不允许超过 1000ms。
  duration: {
    instant: 80,
    quick: 140,
    base: 220,
    slow: 480,
    ambient: 12000, // 环境周期极长 = 几乎静止
  },

  // 缓动：出场陡峭、入场平滑。没有回弹 —— 纸张不回弹。
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    linear: "linear",
    spring: "cubic-bezier(0.22, 1, 0.36, 1)", // 只是「更软的 out」，不是弹跳
  },

  staggerStep: 70, // 逐段揭示，像阅读顺序
  ambientCycle: 12000,
  enterDistance: "10px",
  pointerFactor: 0.15, // 0.15 × 深度 = 几乎不可见的视差

  // 只允许 enter / 极轻的 interact。不给 ambient，不给 data 动效。
  roles: ["enter", "interact"],

  reducedMotion: {
    collapseTo: 0,
    keepOpacity: true, // 透明度淡入保留：它不引发前庭反应
    keepColor: true,
    disableRoles: ["enter", "interact", "ambient", "data"],
  },

  mobile: {
    breakpoint: 768,
    pointer: false,
    distanceScale: 0.6,
    ambient: false,
  },
};

export default editorialMotion;
