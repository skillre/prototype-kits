"use client";

/**
 * DataCursor —— Demo
 *
 * 演示要点：指示器的**语义**来自被标记的 DOM 属性，而不是组件 props。
 * 因此同一个 DataCursor 可以服务整个页面，而不需要为每个数据点配置一次。
 *
 * 两个标记约定：
 *   data-cursor="inspect"        → 悬停时环放大 + 显示读数标签
 *   data-cursor="interactive"    → 悬停时环收紧 + 点亮（表示可点击）
 *   data-cursor-label="…"        → 标签文本（≤48 字符）
 */

import { DataCursor } from "./data-cursor.tsx";
import type { CursorMode } from "./data-cursor.tsx";

export interface DataCursorDemoProps {
  mode?: CursorMode;
  hideNative?: boolean;
}

const READINGS = [
  { id: "P99", value: "184ms", tone: "primary" },
  { id: "P50", value: "42ms", tone: "secondary" },
  { id: "ERR", value: "0.14%", tone: "secondary" },
  { id: "QPS", value: "12.4k", tone: "secondary" },
];

export function DataCursorDemo({
  mode = "ring",
  hideNative = true,
}: DataCursorDemoProps) {
  return (
    <DataCursor mode={mode} hideNative={hideNative}>
      <div className="kits-demo-cursor-area">
        <p className="kits-label">把指针移到读数上</p>
        <ul className="kits-demo-reading-list">
          {READINGS.map((reading) => (
            <li key={reading.id}>
              {/*
                注意：标签信息同时存在于可见文本中（<span>），
                cursor label 只是**增强**，不是唯一的信息载体。
                这保证了触屏用户与屏幕阅读器用户不会丢失信息。
              */}
              <button
                type="button"
                className="kits-demo-reading"
                data-cursor="inspect"
                data-cursor-label={`${reading.id} · ${reading.value}`}
              >
                <span className="kits-label">{reading.id}</span>
                <span className="kits-data">{reading.value}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DataCursor>
  );
}

export default DataCursorDemo;
