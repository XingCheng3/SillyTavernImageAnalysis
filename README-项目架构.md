# SillyTavern 角色卡解析翻译器 - 项目架构指南

## 📋 项目概述

这是一个基于 Vue 3 的 Web 应用，用于解析、编辑、翻译和导出 SillyTavern 角色卡（Character Card）。支持 V1/V2/V3 三种格式，提供完整的世界书（Lorebook）编辑功能，并集成 AI 翻译能力。

### 核心特性
- ✅ **完整兼容 SillyTavern**：解析/导出逻辑与 ST 官方一致，同时写入 `chara` 和 `ccv3` 块
- ✅ **多版本支持**：自动识别并处理 V1/V2/V3 格式角色卡
- ✅ **世界书编辑**：完整支持 SillyTavern 世界书条目的所有字段和扩展属性
- ✅ **AI 批量翻译**：支持基本信息、高级设置、世界书条目的批量翻译（可选择性翻译）
- ✅ **全局文本替换**：一键替换所有字段中的指定文本
- ✅ **翻译结果对比**：翻译完成后可逐项预览原文/译文差异，选择性应用
- ✅ **UTF-8 编码保证**：使用 `TextEncoder/TextDecoder` 确保中文等多语言正确编码

---

## 📁 目录结构与文件说明

```
SillyTavernImageAnalysis/
├── src/
│   ├── views/
│   │   └── index.vue                    # 主页面（已模块化拆分，2600+ 行）
│   │                                     # 核心职责：数据状态管理、API调用、事件协调
│   │
│   ├── components/
│   │   ├── tabs/                        # Tab 页签组件
│   │   │   ├── BasicInfoTab.vue         # 基本信息（描述、性格、场景、首次问候、示例对话）
│   │   │   ├── AdvancedSettingsTab.vue  # 高级设置（系统提示词、历史后指令、备选问候语、作者备注）
│   │   │   └── WorldBookTab.vue         # 世界书（条目列表、关键词、触发条件、高级选项）
│   │   │
│   │   ├── modals/                      # 模态框组件
│   │   │   ├── BatchTranslateModal.vue           # 批量翻译（基本信息6个字段）
│   │   │   ├── AdvancedBatchTranslateModal.vue   # 高级设置批量翻译（支持备选问候语分条目勾选）
│   │   │   ├── BookBatchTranslateModal.vue       # 世界书批量翻译（条目+字段双维度勾选）
│   │   │   ├── GlobalReplaceModal.vue            # 全局替换（实时匹配计数与预览）
│   │   │   └── ErrorModal.vue                    # 统一错误提示
│   │   │
│   │   ├── SettingsModal.vue            # API 设置（URL、Key、模型选择）
│   │   ├── TranslationPromptModal.vue   # 翻译提示词编辑器
│   │   ├── JailbreakTextModal.vue       # 破限文本编辑器
│   │   └── TranslationCompareModal.vue  # 翻译结果对比（原文/译文并排、选择性应用）
│   │
│   ├── utils/
│   │   ├── characterCardParser.js       # 🔥 核心模块：角色卡解析与导出
│   │   │                                 # - 完整的 PNG tEXt 块读写（基于 SillyTavern 源码）
│   │   │                                 # - V1/V2/V3 格式自动识别与转换
│   │   │                                 # - 世界书数据标准化
│   │   │                                 # - 同时写入 chara + ccv3（兼容新旧工具）
│   │   │                                 # - 保留非角色卡的 tEXt 元数据（信息保真）
│   │   │
│   │   ├── translationHelpers.js        # 翻译辅助函数
│   │   │                                 # - buildTranslationPrompt：构建系统提示词
│   │   │                                 # - getFriendlyErrorMessage：错误信息映射
│   │   │                                 # - mapErrorCode：错误代码标准化
│   │   │
│   │   ├── request.js                   # HTTP 请求封装
│   │   ├── pngParser.js                 # PNG 解析工具（已废弃，使用 characterCardParser）
│   │   └── curdVue3.js                  # CRUD 工具
│   │
│   ├── stores/
│   │   ├── app.js                       # 全局状态（API设置、翻译配置）
│   │   └── user.js                      # 用户状态
│   │
│   ├── assets/
│   │   ├── index-view.css               # 🔥 主页面样式（全局引入）
│   │   │                                 # - 容器布局、表单控件、按钮
│   │   │                                 # - 模态框、进度条、世界书卡片
│   │   │                                 # - 响应式适配
│   │   └── main.css                     # 基础全局样式
│   │
│   ├── router/
│   │   ├── index.js                     # 路由配置
│   │   └── useRouteGuard.js             # 路由守卫
│   │
│   └── main.js                          # 入口文件（全局样式引入、插件注册）
│
├── public/
│   └── config.js                        # 公共配置
│
├── tests/
│   └── characterCardParser.test.js      # 角色卡解析器测试
│
├── docs/                                # 文档目录
│   ├── character-card-parser-guide.md   # 角色卡解析器使用指南
│   └── v3-character-card-fix.md         # V3 格式修复文档
│
├── vite.config.js                       # Vite 构建配置
├── package.json                         # 依赖配置
└── README.md                            # 项目说明
```

---

## 🎯 核心功能模块

### 1. 角色卡解析与导出 (`characterCardParser.js`)

**关键类/方法：**
- `CharacterCardParser.parseFromFile(file)` - 从文件解析角色卡
- `CharacterCardParser.exportToPNG(data, originalPng)` - 导出角色卡为 PNG
- `CharacterCardUtils` - 简化 API 封装

**技术要点：**
```javascript
// ⚠️ 关键：同时写入 chara 和 ccv3 块（与 SillyTavern 一致）
const base64Chara = safeBase64Encode(jsonString);
const v3Obj = { ...data, spec: 'chara_card_v3', spec_version: '3.0' };
const base64V3 = safeBase64Encode(JSON.stringify(v3Obj));
// 写入两个 tEXt 块，读取时优先 ccv3
```

**版本兼容策略：**
- V3：`greetings[]` ↔ `first_mes` + `alternate_greetings[]`
- V2/V1：`first_mes` + `alternate_greetings[]`
- 世界书：V3 用 `lore[]`，V2 用 `character_book.entries[]`
- 导出时自动映射为正确格式

**PNG 重建原则：**
1. 提取 IHDR、图像块（IDAT等）、非角色卡的 tEXt/zTXt、IEND
2. 移除旧的 `chara` 和 `ccv3` 块
3. 按顺序写入：PNG 签名 → IHDR → 图像块 → 其他 tEXt → `chara` + `ccv3` → IEND

---

### 2. 批量翻译系统

#### 三种翻译模式

| 模式 | 触发入口 | 可翻译字段 | 特殊功能 |
|------|---------|-----------|---------|
| **基本信息批量翻译** | 基本信息 Tab → "批量翻译所有字段" | name, description, personality, scenario, first_message, message_example | 单次 API 调用，XML 标签分隔 |
| **高级设置批量翻译** | 高级设置 Tab → "批量翻译高级设置" | system_prompt, post_history_instructions, creator_notes, alternate_greetings[] | 🔥 **备选问候语支持分条目勾选**（避免百条问候超上下文） |
| **世界书批量翻译** | 世界书 Tab → "批量翻译条目" | entry.name, entry.keywords, entry.content | 条目+字段双维度勾选，支持部分翻译 |

#### 翻译流程（核心代码位于 `index.vue`）

```javascript
// 1. 构建带标签的文本（关键技术）
const taggedText = fieldsToTranslate.map((item, i) => 
    `<TXT${i+1}>${item.content}</TXT${i+1}>`
).join('\n\n');

// 2. 单次 API 请求翻译所有内容
const response = await fetch(apiSettings.url + '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
        model: apiSettings.model,
        messages: [
            { role: 'system', content: buildTranslationPrompt(translationConfig, true) },
            { role: 'user', content: taggedText }
        ]
    })
});

// 3. 解析返回结果
const regex = new RegExp(`<TXT1>([\\s\\S]*?)</TXT1>`, 'i');
const match = translatedText.match(regex);

// 4. 显示对比弹窗，让用户选择性应用
```

**关键优化：**
- 🔥 **备选问候语分批翻译**：在 `AdvancedBatchTranslateModal` 中，当勾选"备选问候语"时，会展开条目列表供逐条勾选，避免一次性翻译过多导致上下文溢出。
- 时间跟踪：实时显示开始时间、当前时间、已用时长
- 进度可视化：动态进度条 + 百分比 + shimmer 动画
- 错误处理：友好错误提示 + 详情查看 + 重试机制

---

### 3. 世界书编辑

**数据结构：**
```javascript
// 内部编辑格式（扁平化，便于表单绑定）
editableData.book_entries = [{
    id: 0,
    name: '条目名称',
    keysText: '关键词1, 关键词2',  // 逗号分隔的字符串
    keys: ['关键词1', '关键词2'],   // 自动同步数组
    content: '条目内容',
    enabled: true,
    priority: 0,
    depth: 4,
    position: 'after_char',
    // 扩展字段...
    extensions: { /* SillyTavern 扩展对象 */ }
}]
```

**导出转换（关键逻辑在 `characterCardParser.js` 的 `prepareExportData`）：**
```javascript
// 将 book_entries 转回标准格式
exportData.data.character_book = {
    name: '世界书',
    entries: book_entries.map(entry => ({
        id: entry.id,
        keys: entry.keys,
        comment: entry.name,
        content: entry.content,
        extensions: { depth: entry.depth, ... }
    })),
    extensions: {}  // ⚠️ 必须存在（SillyTavern V2 校验要求）
}
```

**字段映射表（关键扩展属性）：**
- `depth` → `extensions.depth`（扫描深度，默认 4）
- `probability` → `extensions.probability`（触发概率，默认 100）
- `group` → `extensions.group`（分组名称）
- `automationId` → `extensions.automation_id`（自动化 ID）
- `caseSensitive` → `extensions.case_sensitive`（区分大小写）
- `matchWholeWords` → `extensions.match_whole_words`（匹配整词）

---

### 4. 全局替换功能

**位置：** 基本信息 Tab → "全局替换文本"

**搜索范围：**
- 基本字段：name, description, personality, scenario, first_message, message_example
- 高级字段：system_prompt, post_history_instructions, creator_notes
- 备选问候语：alternate_greetings[]
- 世界书：所有条目的 name、content、keysText

**实时预览技术：**
```javascript
// checkOccurrences() 在用户输入时触发
const matches = fieldValue.split(searchText).length - 1;
occurrenceDetails.push({
    field: 'description',
    fieldName: '描述',
    count: matches,
    preview: '...上下文...' // 高亮位置前后 20 字符
});
```

---

## 🔧 技术栈与关键依赖

### 核心框架
- **Vue 3** - Composition API + `<script setup>`
- **Pinia** - 状态管理（API 配置、翻译配置持久化到 localStorage）
- **Element Plus** - UI 组件库
- **Vite** - 构建工具

### 关键库
- **pako** - gzip 压缩/解压（PNG zTXt 块支持，当前未使用）
- **pinia** - 响应式状态管理

### 自研模块
- `characterCardParser.js` - 角色卡解析/导出核心引擎
- `translationHelpers.js` - 翻译辅助函数

---

## 🚀 快速上手指南

### 启动项目
```bash
npm install
npm run dev
```

### 使用流程
1. **配置 API**：点击右上角"设置" → 填写 OpenAI 兼容 API 的 URL、Key、模型
2. **上传角色卡**：选择 PNG 格式的角色卡文件
3. **编辑/翻译**：
   - 在三个 Tab（基本信息/高级设置/世界书）中编辑字段
   - 点击"批量翻译"按钮，勾选字段后翻译
   - 翻译完成后在对比弹窗中选择性应用结果
4. **导出**：点击"导出角色卡"，生成新的 PNG 文件

---

## 💡 大模型协作技巧

### 修改建议的关键点

#### 1️⃣ 修改角色卡解析/导出逻辑
**目标文件：** `src/utils/characterCardParser.js`

**常见需求：**
- 添加新字段支持 → 修改 `normalizeCharacterData()` 和 `prepareExportData()`
- 调整版本映射 → 修改对应的 `if (isV3)` 分支
- 修复编码问题 → 检查 `safeBase64Encode/Decode` 函数

**关键函数：**
```javascript
// 解析入口
extractDataFromPNG(data, 'chara')  // 优先读 ccv3，其次 chara

// 导出入口
exportToPNG(characterData, originalPng)
  └─ prepareExportData()      // 字段映射与版本转换
  └─ rebuildPNGWithData()     // PNG 重建（保留其他 tEXt）
```

#### 2️⃣ 修改翻译功能
**目标文件：** `src/views/index.vue`

**关键函数：**
- `startBatchTranslation()` - 基本信息批量翻译
- `startAdvancedBatchTranslation()` - 高级设置批量翻译
- `startBookBatchTranslation()` - 世界书批量翻译
- `prepareTranslationCompare()` - 生成对比数据
- `applySelectedTranslations()` - 应用选中的翻译结果

**状态变量命名规则：**
```javascript
// 基本翻译：isTranslating, translationErrors, translatedCount, ...
// 世界书翻译：isBookTranslating, bookTranslationErrors, bookTranslatedCount, ...
// 高级翻译：isAdvancedTranslating, advancedTranslationErrors, advancedTranslatedCount, ...
```

#### 3️⃣ 修改样式
**目标文件：** `src/assets/index-view.css`

**样式组织：**
```css
/* 容器与布局 */
.container, .header-controls, .tabs, .tab-content

/* 表单控件 */
.editable-input, .editable-textarea, .character-name-input

/* 按钮 */
.action-button, .small-button, .export-button
.action-button.danger / .retry / .secondary / :disabled

/* 模态框 */
.modal-backdrop, .modal-content, .modal-header, .modal-body, .modal-footer

/* 翻译进度 */
.translation-progress, .progress-header, .enhanced-progress-bar, .progress-fill

/* 世界书 */
.book-entry, .entry-header, .entry-keys, .keyword-tags, .option-grid
```

**响应式断点：** `@media (max-width: 768px)`

#### 4️⃣ 添加新的 Tab 页签
1. 在 `src/components/tabs/` 创建新组件
2. 在 `index.vue` 的 `tabs` 数组添加 `{ id: 'new', name: '新页签' }`
3. 在 `<div class="tab-content">` 添加条件渲染

#### 5️⃣ 添加新的批量翻译类型
1. 在 `src/components/modals/` 创建新模态框组件
2. 在 `index.vue` 添加状态变量：
   ```javascript
   const showNewTranslateModal = ref(false);
   const isNewTranslating = ref(false);
   const newTranslationErrors = ref([]);
   // ... 其他状态
   ```
3. 实现 `startNewBatchTranslation()` 函数（参考现有三种）
4. 使用 `buildTranslationPrompt(translationConfig, true)` 构建提示词

---

## ⚠️ 重要注意事项

### 编码问题
- **必须使用** `TextEncoder/TextDecoder` 处理中文等 UTF-8 字符
- Base64 编码前先转 Uint8Array，避免 `btoa()` 直接处理 UTF-8 导致乱码
- 参考 `safeBase64Encode/Decode` 函数

### 数据完整性
- 编辑数据使用 `editableData`（深拷贝自 `characterData`）
- 导出前通过 `prepareExportData()` 转换为标准格式
- **关键：** `book_entries` 是内部编辑格式，导出时必须转回 `character_book.entries`

### 世界书字段映射
```javascript
// 编辑时（UI → 内部）
entry.keysText = "关键词1, 关键词2"  // 输入框绑定
entry.keys = keysText.split(',').map(trim)  // 自动同步

// 导出时（内部 → 标准）
{
    keys: entry.keys,              // 数组
    comment: entry.name,           // 名称
    extensions: {
        depth: entry.depth,
        probability: entry.probability,
        // ... 所有扩展字段
    }
}
```

### V3 格式必须补齐
```javascript
// ⚠️ 导出 V3 时必须确保
exportData.spec = 'chara_card_v3';
exportData.spec_version = '3.0';  // 必须存在

// ⚠️ 导出 V2 时若有世界书必须确保
exportData.data.character_book.extensions = {};  // 必须存在（ST 校验要求）
```

---

## 🐛 常见问题排查

### 1. 导出的角色卡在 SillyTavern 中无法导入
**检查项：**
- 是否同时写入了 `chara` 和 `ccv3` 块？（查看 `exportToPNG`）
- V3 卡是否有 `spec_version = '3.0'`？
- 世界书是否有 `character_book.extensions = {}`？
- 首次问候是否正确映射：V3 用 `first_mes` + `greetings[]`，V2 用 `first_mes`

### 2. 中文翻译后显示乱码
**排查：**
- 检查 `safeBase64Encode/Decode` 是否被正确调用
- 检查 API 返回是否正确解析（`response.json()`）
- 确认 `buildTranslationPrompt` 返回的字符串无异常字符

### 3. 批量翻译失败（上下文超限）
**解决方案：**
- 使用"备选问候语分条目勾选"功能（高级设置批量翻译）
- 将世界书条目分批翻译（取消部分条目勾选）
- 减少单次翻译字段数量

### 4. 世界书条目保存后数据丢失
**检查：**
- 是否调用了 `updateEntryKeys(entry)` 同步 `keysText` → `keys`？
- 导出时是否正确调用 `prepareExportData()` 转换 `book_entries` → `character_book.entries`？

### 5. 样式丢失或错乱
**确认：**
- `src/main.js` 是否引入了 `./assets/index-view.css`
- 子组件是否使用了全局样式类名（不需要 `scoped` 重复定义）
- 检查浏览器控制台是否有 CSS 加载错误

---

## 📊 性能优化建议

### 当前状态
- `index.vue`：约 2600 行（已从 5100+ 行拆分）
- 模块化组件：10+ 个子组件
- 全局样式：统一管理，避免重复

### 进一步优化方向
1. **提取 Composables**：
   ```javascript
   // 建议创建 src/composables/
   - useTranslationProgress.js  // 时间跟踪、进度计算
   - useWorldBook.js            // 世界书 CRUD 逻辑
   - useAlternateGreetings.js   // 备选问候语管理
   ```

2. **状态管理优化**：
   - 将 `editableData` 移入 Pinia Store
   - 翻译状态抽象为独立 Store

3. **代码分割**：
   - 使用 `defineAsyncComponent` 懒加载模态框组件
   - 路由级别代码分割

---

## 🔑 关键 API 参考

### CharacterCardParser API

```javascript
import { CharacterCardUtils } from '@/utils/characterCardParser';

// 解析角色卡
const result = await CharacterCardUtils.parseFile(file);
// result.success, result.data, result.metadata

// 导出角色卡
const pngBytes = CharacterCardUtils.exportToPNG(characterData, originalPng);

// 下载文件
CharacterCardUtils.downloadPNG(pngBytes, 'character.png');

// 验证角色卡
const validation = CharacterCardUtils.validate(data);
// validation.valid, validation.errors, validation.warnings
```

### 翻译辅助 API

```javascript
import { buildTranslationPrompt, getFriendlyErrorMessage, mapErrorCode } from '@/utils/translationHelpers';

// 构建提示词
const prompt = buildTranslationPrompt(translationConfig, true);

// 错误处理
const friendlyMsg = getFriendlyErrorMessage(errorObj);
const errorCode = mapErrorCode(errorObj);
```

---

## 📝 代码规范

### 命名约定
- 组件文件：PascalCase（`SettingsModal.vue`）
- 工具文件：camelCase（`characterCardParser.js`）
- 样式类：kebab-case（`.modal-backdrop`）
- 状态变量：camelCase（`showBatchTranslateModal`）

### 组件通信
- **Props Down**：父组件向子组件传递数据和状态
- **Events Up**：子组件通过 `emit` 触发父组件方法
- **全局状态**：API 配置、翻译配置使用 Pinia Store

### 样式组织
- **全局样式**：`src/assets/index-view.css`（模态框、表单、按钮、进度条）
- **组件样式**：各组件的 `<style scoped>` 仅写特有样式（当前大部分组件复用全局）

---

## 🎨 UI/UX 设计说明

### 配色方案
- 主色：`#4a89dc`（蓝色 - 按钮、链接、激活状态）
- 辅助色：`#667eea` → `#764ba2`（渐变 - 头部、模态标题）
- 危险色：`#e74c3c`（删除、错误）
- 警告色：`#f39c12`（重试）
- 成功色：`#2ecc71`（成功提示）

### 交互反馈
- 按钮：hover 变色 + `translateY(-1px)` + 阴影增强
- 输入框：focus 蓝色边框 + 外阴影 + `translateY(-1px)`
- 进度条：shimmer 动画（2s 循环）+ 渐变移动
- 齿轮图标：旋转动画（2s 循环）

---

## 🔍 调试技巧

### 控制台日志关键点
```javascript
// 解析时
console.log('成功解析角色卡数据:', parseResult);
console.log('角色卡版本:', parseResult.metadata.version);

// 导出时
console.log('=== 导出数据准备开始 ===');
console.log('V3导出 greetings:', exportData.data.greetings);

// 翻译时
console.log('API返回的翻译结果:', translatedText);
console.log('解析标签 TXT1:', match ? '成功' : '失败');
```

### 常用 DevTools 检查
- **Network**：查看翻译 API 请求/响应
- **Vue DevTools**：检查 `editableData`、`characterData` 状态
- **Console**：查看 PNG 块提取日志、世界书条目数量

---

## 📚 扩展阅读

- [SillyTavern 官方文档](https://github.com/SillyTavern/SillyTavern)
- [Character Card Spec V2](https://github.com/malfoyslastname/character-card-spec-v2)
- `docs/character-card-parser-guide.md` - 本项目的解析器详细指南
- `docs/v3-character-card-fix.md` - V3 格式修复说明

---

## 🤖 大模型协作提示词模板

### 修改角色卡解析逻辑
```
我需要修改角色卡解析器的 [具体需求]。
关键文件：src/utils/characterCardParser.js
目标函数：[extractDataFromPNG / prepareExportData / normalizeCharacterData]
期望效果：[描述预期行为]
```

### 添加新的翻译字段
```
我需要在 [基本信息/高级设置/世界书] 批量翻译中添加 [字段名] 字段。
参考现有字段：[description / system_prompt / entry.content]
需要修改：
1. src/views/index.vue 的 [start***Translation] 函数
2. src/components/modals/[对应Modal].vue 添加勾选项
```

### 调整 UI 样式
```
我需要修改 [具体组件/区域] 的样式。
目标文件：src/assets/index-view.css
相关类名：[.modal-content / .progress-bar / .book-entry]
期望效果：[颜色/尺寸/布局调整]
```

---

## 📄 License

本项目基于 SillyTavern 源码改造，遵循原项目 AGPL-3.0 许可证。

---

**最后更新：** 2025-10-25  
**维护者：** 项目开发者  
**版本：** 1.0.0

