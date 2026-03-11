<template>
    <div class="tab-pane worldbook-tab">
        <div v-if="hasCharacterBook">
            <div class="tab-intro-card">
                <div>
                    <p class="eyebrow">世界书</p>
                    <h3>管理角色依赖的背景知识和触发条目</h3>
                    <p class="intro-text">
                        世界书适合放地点、人设补充、组织、道具、规则和事件说明。关键词尽量短而准，内容尽量写成能直接插入上下文的知识片段。
                    </p>
                </div>
                <div class="intro-actions">
                    <button @click="$emit('open-ai-generate')" class="small-button">AI 代写世界书</button>
                    <button @click="$emit('open-batch-translate')" class="small-button" :disabled="!editableData.book_entries || editableData.book_entries.length === 0">
                        批量翻译条目
                    </button>
                    <button @click="$emit('add-entry')" class="small-button primary">添加新条目</button>
                </div>
            </div>

            <div class="summary-grid">
                <div class="summary-card">
                    <span class="summary-label">当前规格</span>
                    <strong>{{ isV3 ? 'V3 / ccv3' : 'V1 / V2 / chara' }}</strong>
                </div>
                <div class="summary-card">
                    <span class="summary-label">条目数量</span>
                    <strong>{{ editableData.book_entries?.length || 0 }}</strong>
                </div>
                <div class="summary-card">
                    <span class="summary-label">世界书名称</span>
                    <strong>{{ editableData.character_book?.name || '未命名世界书' }}</strong>
                </div>
            </div>

            <div class="data-item worldbook-meta-card">
                <div class="section-title-row">
                    <div>
                        <h3>世界书信息</h3>
                        <p>先把世界书的名称和整体说明写清楚，再逐条维护条目。</p>
                    </div>
                </div>

                <div class="book-info-grid">
                    <div class="book-info-field">
                        <label>名称</label>
                        <input type="text" v-if="editableData.character_book" v-model="editableData.character_book.name" class="editable-input" placeholder="世界书名称" />
                        <input type="text" v-else disabled placeholder="未设置" class="editable-input" />
                    </div>
                    <div class="book-info-field full-width">
                        <label>描述</label>
                        <input type="text" v-if="editableData.character_book" v-model="editableData.character_book.description" class="editable-input" placeholder="简要描述世界书内容、用途或覆盖范围" />
                        <input type="text" v-else disabled placeholder="未设置" class="editable-input" />
                    </div>
                    <div class="book-info-field" v-if="!isV3 && editableData.character_book">
                        <label>扫描深度</label>
                        <input type="number" v-model.number="editableData.character_book.scan_depth" class="editable-input" />
                    </div>
                    <div class="book-info-field" v-if="!isV3 && editableData.character_book">
                        <label>Token 预算</label>
                        <input type="number" v-model.number="editableData.character_book.token_budget" class="editable-input" />
                    </div>
                </div>
            </div>

            <div class="book-section">
                <div class="book-section-header">
                    <div>
                        <h3>条目列表</h3>
                        <p>建议一条只写一类知识，关键词围绕触发条件来写，避免把多个主题塞进一条。</p>
                    </div>
                    <span class="entry-count">{{ editableData.book_entries?.length || 0 }} 条</span>
                </div>
            </div>

            <div v-if="editableData.book_entries && editableData.book_entries.length > 0" class="entries-list worldbook-entries-list">
                <div v-for="(entry, index) in editableData.book_entries" :key="index" class="book-entry worldbook-entry-card">
                    <div class="entry-header">
                        <div class="entry-title-block">
                            <span class="entry-index">条目 {{ index + 1 }}</span>
                            <input type="text" v-model="entry.name" placeholder="为此条目起一个清晰的名称" class="editable-input" />
                        </div>
                        <div class="entry-actions">
                            <label class="toggle-switch">
                                <input type="checkbox" v-model="entry.enabled" />
                                <span class="slider"></span>
                                <span class="toggle-label">{{ entry.enabled ? '启用' : '禁用' }}</span>
                            </label>
                            <button @click="$emit('remove-entry', index)" class="small-button danger">删除</button>
                        </div>
                    </div>

                    <div class="entry-keys card-block">
                        <div class="block-title-row">
                            <strong>关键词</strong>
                            <span class="block-tip">用逗号分隔，尽量写触发点而不是整句</span>
                        </div>
                        <input type="text" v-model="entry.keysText" placeholder="例如：组织名, 地点名, 物品名, 事件名" class="editable-input" @input="$emit('update-keys', entry)" />
                        <div class="keyword-tags" v-if="entry.keys && entry.keys.length > 0">
                            <span v-for="(key, kidx) in entry.keys" :key="kidx" class="keyword-tag">{{ key }}</span>
                        </div>
                    </div>

                    <div class="entry-content card-block">
                        <div class="block-title-row">
                            <strong>条目内容</strong>
                            <span class="block-tip">建议写成可直接插入上下文的背景说明</span>
                        </div>
                        <textarea v-model="entry.content" class="editable-textarea" placeholder="输入该世界书条目的详细内容，描述相关背景知识、设定、规则或补充信息……"></textarea>
                    </div>

                    <div class="entry-options card-block">
                        <div class="block-title-row">
                            <strong>基础选项</strong>
                            <span class="block-tip">这些字段会影响插入顺序、命中概率和启用策略</span>
                        </div>
                        <div class="option-grid">
                            <div class="option-item">
                                <label>优先级</label>
                                <input type="number" v-model.number="entry.priority" class="small-input" />
                            </div>
                            <div class="option-item">
                                <label>深度</label>
                                <input type="number" v-model.number="entry.depth" class="small-input" min="0" max="100" />
                            </div>
                            <div class="option-item">
                                <label>位置</label>
                                <select v-model="entry.position" class="small-input">
                                    <option value="after_char">角色后</option>
                                    <option value="before_char">角色前</option>
                                </select>
                            </div>
                            <div class="option-item">
                                <label>概率</label>
                                <input type="number" v-model.number="entry.probability" class="small-input" min="0" max="100" />
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.selective" />
                                    <span class="slider"></span>
                                </label>
                                <span>有选择性</span>
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.constant" />
                                    <span class="slider"></span>
                                </label>
                                <span>常驻</span>
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.useProbability" />
                                    <span class="slider"></span>
                                </label>
                                <span>启用概率</span>
                            </div>
                        </div>
                    </div>

                    <div class="advanced-options card-block">
                        <details>
                            <summary>高级选项（组、扫描、匹配规则）</summary>
                            <div class="advanced-option-grid">
                                <div class="option-item">
                                    <label>组名</label>
                                    <input type="text" v-model="entry.group" class="small-input" placeholder="例如：地区设定" />
                                </div>
                                <div class="option-item">
                                    <label>组权重</label>
                                    <input type="number" v-model.number="entry.groupWeight" class="small-input" min="0" max="1000" />
                                </div>
                                <div class="option-item">
                                    <label>扫描深度</label>
                                    <input type="number" v-model.number="entry.scanDepth" class="small-input" min="0" max="100" />
                                </div>
                                <div class="option-item">
                                    <label>自动化 ID</label>
                                    <input type="text" v-model="entry.automationId" class="small-input" placeholder="自动化 ID" />
                                </div>
                                <div class="option-item toggle-option">
                                    <label class="toggle-switch">
                                        <input type="checkbox" v-model="entry.groupOverride" />
                                        <span class="slider"></span>
                                    </label>
                                    <span>组覆盖</span>
                                </div>
                                <div class="option-item toggle-option">
                                    <label class="toggle-switch">
                                        <input type="checkbox" v-model="entry.caseSensitive" />
                                        <span class="slider"></span>
                                    </label>
                                    <span>区分大小写</span>
                                </div>
                                <div class="option-item toggle-option">
                                    <label class="toggle-switch">
                                        <input type="checkbox" v-model="entry.matchWholeWords" />
                                        <span class="slider"></span>
                                    </label>
                                    <span>匹配整词</span>
                                </div>
                                <div class="option-item toggle-option">
                                    <label class="toggle-switch">
                                        <input type="checkbox" v-model="entry.excludeRecursion" />
                                        <span class="slider"></span>
                                    </label>
                                    <span>排除递归</span>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
            <div v-else class="empty-state-card">
                <div>
                    <strong>还没有任何条目</strong>
                    <p>你可以先从 1～3 条核心设定开始：比如角色所处地点、组织背景、关键人物或常见道具。</p>
                </div>
                <button @click="$emit('add-entry')" class="small-button primary">创建第一条</button>
            </div>
        </div>
        <div v-else class="empty-state-card large-empty">
            <div>
                <p class="eyebrow">世界书未启用</p>
                <h3>这个角色卡当前没有世界书</h3>
                <p>如果你想给角色补充更多背景知识、设定条目和触发信息，可以先创建一个空世界书，再逐步添加条目。</p>
            </div>
            <button @click="$emit('create-book')" class="action-button">创建世界书</button>
        </div>
    </div>
</template>

<script setup>
defineProps({
    editableData: { type: Object, required: true },
    hasCharacterBook: { type: Boolean, required: true },
    isV3: { type: Boolean, default: false },
});

defineEmits(['open-ai-generate', 'open-batch-translate', 'add-entry', 'remove-entry', 'create-book', 'update-keys']);
</script>

<style scoped>
.worldbook-tab {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.tab-intro-card {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 18px;
    border-radius: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #f7f6f3 100%);
    border: 1px solid #dfdbd3;
    margin-bottom: 16px;
}

.eyebrow {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #a16207;
}

.tab-intro-card h3 {
    margin: 0 0 8px;
    font-size: 22px;
    color: #0f172a;
}

.intro-text {
    margin: 0;
    line-height: 1.7;
    color: #475569;
    max-width: 760px;
}

.intro-actions {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.summary-card {
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: #fff;
}

.summary-label {
    display: block;
    margin-bottom: 6px;
    color: #64748b;
    font-size: 12px;
}

.summary-card strong {
    color: #0f172a;
    font-size: 16px;
}

.worldbook-meta-card,
.book-entry,
.empty-state-card {
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    background: #fff;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.04);
}

.worldbook-meta-card,
.book-entry {
    padding: 18px;
}

.section-title-row h3,
.book-section-header h3 {
    margin: 0 0 6px;
    color: #0f172a;
}

.section-title-row p,
.book-section-header p {
    margin: 0;
    color: #64748b;
    line-height: 1.6;
}

.book-info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 16px;
}

.book-info-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.book-info-field label {
    font-size: 13px;
    color: #475569;
    font-weight: 600;
}

.full-width {
    grid-column: 1 / -1;
}

.book-section {
    margin: 18px 0 10px;
}

.book-section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    padding: 0 2px;
}

.entry-count {
    color: #475569;
    font-size: 13px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 6px 10px;
    border-radius: 999px;
}

.entries-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.worldbook-entries-list {
    gap: 18px;
}

.worldbook-entry-card {
    padding: 20px;
    border-radius: 20px;
    border: 1px solid #d6d3d1;
    background: linear-gradient(180deg, #ffffff 0%, #fafaf9 100%);
}

.entry-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
    align-items: flex-start;
}

.entry-title-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
}

.entry-index {
    font-size: 12px;
    color: #6366f1;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.entry-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.card-block {
    padding: 16px;
    border-radius: 16px;
    background: #f7f6f3;
    border: 1px solid #dfdbd3;
    margin-top: 12px;
}

.block-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.block-tip {
    color: #64748b;
    font-size: 12px;
}

.keyword-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}

.keyword-tag {
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    background: #f5f5f4;
    color: #44403c;
    border: 1px solid #d6d3d1;
}

.option-grid,
.advanced-option-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
}

.option-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.option-item label {
    color: #475569;
    font-size: 13px;
    font-weight: 600;
}

.toggle-option {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding-top: 24px;
}

.advanced-options details {
    margin-top: 12px;
}

.advanced-options summary {
    cursor: pointer;
    color: #334155;
    font-weight: 600;
}

.empty-state-card {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 20px;
}

.empty-state-card strong,
.empty-state-card h3 {
    display: block;
    margin: 0 0 8px;
    color: #0f172a;
}

.empty-state-card p {
    margin: 0;
    color: #64748b;
    line-height: 1.7;
}

.large-empty {
    align-items: center;
    background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    border-style: dashed;
}

@media (max-width: 980px) {
    .tab-intro-card,
    .book-section-header,
    .entry-header,
    .empty-state-card,
    .large-empty {
        flex-direction: column;
        align-items: stretch;
    }

    .worldbook-entry-card {
        padding: 16px;
    }

    .summary-grid,
    .book-info-grid,
    .option-grid,
    .advanced-option-grid {
        grid-template-columns: 1fr;
    }

    .block-title-row {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
