# Reference Board · incoming

> 还没有归类的外部参考。**这是参考板的入口，不是资产库的入口。**

---

## 这里放什么

暂时无法归类到 `editorial` / `cinematic` / `instrument` 的外部参考。
典型场景：

- 看到一个有意思的交互，但还没判断它属于哪套风格；
- 看到一个新的视觉流派（例如某种拟物回潮、某种印刷质感），需要先观察；
- 参考本身是混合的（同时具备两种风格特征）。

---

## 处理流程

```
incoming/（先放这里）
  ↓ 每周/每次归类时处理
判断：它是「设计语言参考」还是「可用的代码资产」？
  │
  ├── 设计语言参考 → 分析后移入 references/<pack>/README.md
  │                   （只保留分析文字，不保留源码）
  │
  └── 代码资产     → 移入 incoming/components|styles|effects|skills/
                     走完整的 incoming 流程（见根 README 第七节）
```

### 关键区分

| | 设计语言参考 | 代码资产 |
|---|---|---|
| 内容 | 链接 + 分析文字 | 实际的源码/包 |
| 去向 | `references/<pack>/` | `incoming/<type>/` → adapter → 组件包 |
| 登记 | **不登记**（不是资产） | 必须在 `registry/assets.json` 登记 |
| 产品可用 | 不直接可用（只影响决策） | 通过内部 API 后可用 |

---

## 条目格式

```markdown
### <标题>

- **来源**：<链接>
- **作者 / 组织**：<名称>
- **发现日期**：<YYYY-MM-DD>
- **初步判断**：<editorial / cinematic / instrument / 待定>
- **类型**：<landing / component / effect / skill / 其他>

#### 观察

<它做了什么？为什么显得成立？>

#### 待确认

- [ ] 它属于哪套 pack？
- [ ] 如果是代码资产：许可证是什么？
- [ ] 如果是代码资产：依赖了什么？
- [ ] 如果不属于任何现有 pack：是否需要新 pack？（新 pack 是重大决定，需要契约评审）
