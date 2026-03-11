# 世界书 AI 代写规范（M0 冻结）

> 版本：v1（2026-03-11）

## 1. 蓝绿灯语义（用户确认）

- **蓝灯（blue）**：必须命中关键词才载入上下文。
  - 映射：`selective=true`、`constant=false`
  - 约束：`keys` 至少 1 个
- **绿灯（green）**：直接载入上下文（常驻）。
  - 映射：`constant=true`、`selective=false`

> `enabled=false` 代表条目关闭，不参与上下文。

---

## 2. 结构化生成策略

禁止一次性自由文本全量生成。
采用「先骨架、后内容、再校验」：

1. 生成条目骨架（标题/关键词/灯类型/顺序/深度/位置）
2. 分批生成条目正文（推荐每批 3~5 条）
3. 结构校验与冲突检查
4. 预览 + 勾选应用 + 快照回滚

---

## 3. 草稿交换格式（紧凑 DSL）

草稿 schema：`sillytavern.worldbook.ai.draft.v1`

- `c`: comment/title
- `k`: keywords
- `lt`: light type (`blue|green`)
- `io`: insertion_order
- `dp`: depth
- `ps`: position (`b|a` => `before_char|after_char`)
- `en`: enabled
- `sm`: summary
- `ct`: content

最终落盘时会映射到标准角色卡 JSON，保证兼容现有导入导出。

---

## 4. 局部改写规范（M1）

支持以下粒度：

- entry 级：整条改写
- paragraph 级：指定段落改写
- field 级：指定字段（如 `comment`/`content`/`keys`）

支持模式：

- `rewrite`（重写）
- `replace`（替换）
- `append`（追加）
- `prepend`（前置追加）

---

## 5. 质量门槛（每批改动固定执行）

- `npm run lint`
- `npm run build:only`
- `npm run test:all`
- `npm run build`（部署到宝塔）

---

## 6. 后续里程碑

- M2：接入 UI 生成向导 + AI 调用
- M3：接入局部改写 UI（条目/段落）
- M4：差异预览 + 勾选应用 + 回滚
- M5：开场白分支联动条目开关 + 封面替换
