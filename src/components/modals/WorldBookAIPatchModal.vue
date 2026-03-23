<template>
    <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
        <div class="modal-content worldbook-ai-modal worldbook-ai-patch-modal">
            <div class="modal-header">
                <h2>AI 局部改写世界书</h2>
                <button @click="$emit('close')" class="close-button">&times;</button>
            </div>

            <div class="modal-body">
                <div class="section-card tips-card">
                    <h3>改写流程</h3>
                    <ol>
                        <li>勾选本次允许 AI 修改的条目（可多选，默认全选）</li>
                        <li>输入改写指令，点击“生成改写预览”</li>
                        <li>按条目/按 operation 复核差异后再应用</li>
                    </ol>
                </div>

                <div class="section-card">
                    <h3>改写设置</h3>

                    <div class="entry-select-head">
                        <p>可修改条目（{{ selectedEntryCount }} / {{ entries.length }}）</p>
                        <div class="entry-select-actions" v-if="entries.length">
                            <button type="button" class="small-button" @click="selectAllEntries">全选</button>
                            <button type="button" class="small-button" @click="clearSelectedEntries">清空</button>
                        </div>
                    </div>

                    <div class="entry-select-list" v-if="entries.length">
                        <label
                            v-for="item in entrySelectionList"
                            :key="item.entryId"
                            class="entry-select-item"
                        >
                            <input
                                type="checkbox"
                                v-model="form.selectedEntryIds"
                                :value="item.entryId"
                            />
                            <div class="entry-select-body">
                                <div class="entry-select-title">
                                    <strong>{{ item.title }}</strong>
                                    <span>ID: {{ item.entryId }}</span>
                                </div>
                                <p>{{ item.excerpt || '（该条目内容为空）' }}</p>
                            </div>
                        </label>
                    </div>
                    <p v-else class="entry-select-empty">当前没有可改写条目，请先新增条目或先执行 AI 代写。</p>

                    <div class="form-grid">
                        <label class="field full">
                            <span>改写指令（必填）</span>
                            <textarea
                                v-model="form.instruction"
                                class="editable-textarea"
                                placeholder="例如：统一把政治势力描述改为更写实、更克制；保留原设定结论，不要改世界观事实。"
                            ></textarea>
                        </label>
                    </div>

                    <div class="switch-stack">
                        <label class="replace-switch">
                            <input type="checkbox" v-model="form.keepStyle" />
                            <span>尽量保留原文风格</span>
                        </label>
                    </div>
                </div>

                <div v-if="preview" class="section-card preview-card">
                    <div class="preview-head">
                        <h3>改写预览</h3>
                        <span class="count-chip">{{ preview.changed ? '有变化' : '无变化' }}</span>
                    </div>
                    <p class="book-meta">
                        涉及 <strong>{{ preview.affectedEntryCount }}</strong> 个条目
                        ｜<strong>{{ preview.operationCount }}</strong> 个 patch 操作
                        ｜成功 <strong>{{ preview.successOperationCount ?? 0 }}</strong>
                        ｜失败 <strong>{{ preview.failedOperationCount ?? 0 }}</strong>
                    </p>
                    <p v-if="preview.summary" class="preview-summary">{{ preview.summary }}</p>

                    <div v-for="item in preview.entryPreviews" :key="`${item.entryId}-${item.field}`" class="entry-preview-card">
                        <div class="entry-preview-head">
                            <label class="entry-preview-toggle">
                                <input
                                    type="checkbox"
                                    :checked="isEntrySelected(item)"
                                    @change="toggleEntryOperations(item, $event.target.checked)"
                                />
                                <div>
                                    <strong>{{ item.entryTitle }}</strong>
                                    <p>
                                        字段：{{ item.field }} ｜ 操作数：{{ item.operationItems?.length || item.operations?.length || 0 }}
                                        ｜ 已选 {{ countSelectedOperations(item) }}
                                    </p>
                                </div>
                            </label>
                            <span class="count-chip small">{{ item.changed ? '已变更' : '无变化' }}</span>
                        </div>

                        <div class="operation-list" v-if="item.operationItems?.length">
                            <label
                                v-for="op in item.operationItems"
                                :key="`${item.entryId}-${item.field}-${op.opId || op.index}`"
                                class="operation-item"
                                :class="{ failed: !op.ok }"
                            >
                                <input
                                    type="checkbox"
                                    v-model="op.selected"
                                    :disabled="!op.ok"
                                    @change="syncEntrySelection(item)"
                                />
                                <div class="operation-body">
                                    <p class="operation-title">
                                        #{{ op.index + 1 }} · {{ op.action }}
                                        <span v-if="op.opId">（{{ op.opId }}）</span>
                                    </p>
                                    <p class="operation-meta">{{ formatOperationBrief(op) }}</p>
                                    <p v-if="!op.ok" class="operation-error">失败原因：{{ op.errorMessage || '未知错误' }}</p>
                                </div>
                            </label>
                        </div>

                        <div class="diff-grid">
                            <div class="diff-col">
                                <h4>改写前</h4>
                                <textarea class="diff-text" readonly :value="item.beforeText"></textarea>
                            </div>
                            <div class="diff-col">
                                <h4>改写后</h4>
                                <textarea class="diff-text" readonly :value="item.afterText"></textarea>
                            </div>
                        </div>

                        <div class="diff-summary" v-if="item.diffSummary">
                            <span class="chip add">+{{ item.diffSummary.add }} 新增行</span>
                            <span class="chip remove">-{{ item.diffSummary.remove }} 删除行</span>
                            <span class="chip context">={{ item.diffSummary.context }} 相同行</span>
                        </div>

                        <div class="line-diff" v-if="item.lineDiff?.lines?.length">
                            <div
                                v-for="(line, idx) in item.lineDiff.lines"
                                :key="`${item.entryId}-${item.field}-${line.type}-${idx}`"
                                class="line-item"
                                :class="line.type"
                            >
                                <span class="marker">{{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : '·' }}</span>
                                <span class="text">{{ line.text || ' ' }}</span>
                            </div>
                            <p v-if="item.lineDiff.truncated" class="diff-truncated-tip">
                                仅展示前 {{ item.lineDiff.lines.length }} 行差异（总计 {{ item.lineDiff.total }} 行）。
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <label class="confirm-apply" v-if="preview">
                    <input type="checkbox" v-model="form.confirmReviewedDiff" />
                    <span>我已核对差异并确认应用改写结果</span>
                </label>
                <button class="action-button secondary" @click="$emit('close')">取消</button>
                <button
                    class="action-button"
                    @click="$emit('generate')"
                    :disabled="isGenerating || !form.instruction?.trim() || selectedEntryCount === 0"
                >
                    {{ isGenerating ? '生成中...' : (preview ? '重新生成改写预览' : '生成改写预览') }}
                </button>
                <button class="action-button" @click="$emit('apply')" :disabled="!preview || isGenerating || !form.confirmReviewedDiff || selectedOperationCount === 0">应用改写</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    show: { type: Boolean, required: true },
    isGenerating: { type: Boolean, default: false },
    form: { type: Object, required: true },
    preview: { type: Object, default: null },
    entries: { type: Array, default: () => [] },
});

defineEmits(['close', 'generate', 'apply']);

const entrySelectionList = computed(() => {
    return (props.entries || []).map((entry, index) => {
        const content = String(entry?.content || '').replace(/\s+/g, ' ').trim();
        return {
            entryId: String(entry?.id ?? ''),
            title: entry?.name || entry?.comment || `条目 ${index + 1}`,
            excerpt: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
        };
    });
});

const selectedEntryCount = computed(() => {
    const selected = Array.isArray(props.form?.selectedEntryIds) ? props.form.selectedEntryIds : [];
    return selected.length;
});

const selectAllEntries = () => {
    props.form.selectedEntryIds = (props.entries || []).map(entry => String(entry?.id ?? '')).filter(Boolean);
};

const clearSelectedEntries = () => {
    props.form.selectedEntryIds = [];
};

const countSelectedOperations = (item = {}) => {
    return (item.operationItems || []).filter(op => op.selected).length;
};

const isEntrySelected = (item = {}) => {
    const operationItems = item.operationItems || [];
    if (!operationItems.length) return item.selected !== false;
    return operationItems.some(op => op.selected);
};

const syncEntrySelection = (item = {}) => {
    item.selected = isEntrySelected(item);
};

const toggleEntryOperations = (item = {}, checked = false) => {
    const operationItems = item.operationItems || [];
    if (!operationItems.length) {
        item.selected = checked;
        return;
    }

    operationItems.forEach((op) => {
        if (op.ok === false) return;
        op.selected = checked;
    });
    item.selected = checked;
};

const selectedOperationCount = computed(() => {
    return (props.preview?.entryPreviews || [])
        .reduce((sum, item) => sum + countSelectedOperations(item), 0);
});

const formatOperationBrief = (op = {}) => {
    if (op.action === 'replace_whole') {
        return '整段替换。';
    }

    if (op.action === 'replace_paragraph') {
        return `段落 #${Number.isFinite(op.paragraphIndex) ? op.paragraphIndex : '?'} 替换。`;
    }

    if (!op.searchText) {
        return '未提供 searchText。';
    }

    const snippet = String(op.searchText).replace(/\s+/g, ' ').trim();
    return `定位片段：${snippet.slice(0, 60)}${snippet.length > 60 ? '…' : ''}`;
};
</script>

<style scoped>
.worldbook-ai-patch-modal {
    width: min(100%, 1180px);
}

.section-card {
    border: 1px solid #dfdbd3;
    border-radius: 16px;
    padding: 14px;
    background: #fff;
    margin-bottom: 14px;
}

.section-card h3 {
    margin: 0 0 12px;
    font-size: 17px;
}

.tips-card ol {
    margin: 0;
    padding-left: 20px;
    color: #57534e;
    line-height: 1.8;
}

.entry-select-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}

.entry-select-head p {
    margin: 0;
    color: #57534e;
    font-size: 13px;
    font-weight: 700;
}

.entry-select-actions {
    display: inline-flex;
    gap: 8px;
}

.entry-select-list {
    display: grid;
    gap: 8px;
    max-height: 240px;
    overflow: auto;
    border: 1px solid #e7e5e4;
    border-radius: 12px;
    padding: 10px;
    background: #fafaf9;
}

.entry-select-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border: 1px solid #e7e5e4;
    border-radius: 10px;
    padding: 8px 10px;
    background: #fff;
}

.entry-select-item input {
    margin-top: 4px;
}

.entry-select-body {
    min-width: 0;
}

.entry-select-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.entry-select-title strong {
    font-size: 13px;
    color: #292524;
}

.entry-select-title span {
    font-size: 11px;
    color: #78716c;
}

.entry-select-body p {
    margin: 4px 0 0;
    color: #78716c;
    font-size: 12px;
    line-height: 1.5;
}

.entry-select-empty {
    margin: 0;
    font-size: 12px;
    color: #a8a29e;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field > span {
    font-size: 13px;
    color: #57534e;
    font-weight: 700;
}

.field.full {
    grid-column: 1 / -1;
}

.switch-stack {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.replace-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #44403c;
}

.preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.count-chip {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid #d6d3d1;
    background: #f5f5f4;
    font-size: 12px;
    color: #57534e;
    font-weight: 700;
}

.book-meta {
    margin: 0 0 8px;
    color: #57534e;
    font-size: 13px;
}

.preview-summary {
    margin: 0 0 14px;
    color: #44403c;
    line-height: 1.6;
}

.entry-preview-card {
    border: 1px solid #e7e5e4;
    border-radius: 14px;
    padding: 14px;
    background: #fcfcfb;
    margin-top: 14px;
}

.entry-preview-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.entry-preview-toggle {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.entry-preview-toggle input {
    margin-top: 3px;
}

.entry-preview-head p {
    margin: 4px 0 0;
    color: #78716c;
    font-size: 12px;
}

.operation-list {
    display: grid;
    gap: 8px;
    margin-bottom: 12px;
}

.operation-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border: 1px solid #e7e5e4;
    border-radius: 10px;
    padding: 8px 10px;
    background: #fff;
}

.operation-item.failed {
    border-color: #fecaca;
    background: #fff7f7;
}

.operation-item input {
    margin-top: 4px;
}

.operation-body {
    min-width: 0;
}

.operation-title {
    margin: 0;
    color: #292524;
    font-size: 12px;
    font-weight: 700;
}

.operation-meta {
    margin: 4px 0 0;
    color: #57534e;
    font-size: 12px;
}

.operation-error {
    margin: 4px 0 0;
    color: #b91c1c;
    font-size: 12px;
}

.count-chip.small {
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
}

.diff-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.diff-col h4 {
    margin: 0 0 8px;
    font-size: 13px;
    color: #44403c;
}

.diff-text {
    width: 100%;
    min-height: 180px;
    max-height: 320px;
    border: 1px solid #dfdbd3;
    border-radius: 12px;
    padding: 10px;
    font-size: 13px;
    line-height: 1.6;
    color: #292524;
    background: #fafaf9;
    resize: vertical;
}

.diff-summary {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.chip {
    display: inline-flex;
    align-items: center;
    height: 26px;
    border-radius: 999px;
    padding: 0 10px;
    border: 1px solid #d6d3d1;
    font-size: 12px;
    font-weight: 700;
}

.chip.add {
    color: #166534;
    background: #dcfce7;
    border-color: #86efac;
}

.chip.remove {
    color: #991b1b;
    background: #fee2e2;
    border-color: #fca5a5;
}

.chip.context {
    color: #57534e;
    background: #f5f5f4;
    border-color: #d6d3d1;
}

.line-diff {
    margin-top: 10px;
    border: 1px solid #dfdbd3;
    border-radius: 12px;
    max-height: 260px;
    overflow: auto;
    background: #fafaf9;
}

.line-item {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 8px;
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.5;
    border-bottom: 1px dashed #e7e5e4;
}

.line-item:last-child {
    border-bottom: none;
}

.line-item .marker {
    font-weight: 700;
    color: #a8a29e;
}

.line-item.add {
    background: #f0fdf4;
}

.line-item.add .marker {
    color: #16a34a;
}

.line-item.remove {
    background: #fef2f2;
}

.line-item.remove .marker {
    color: #dc2626;
}

.line-item.context {
    background: #fafaf9;
}

.line-item .text {
    white-space: pre-wrap;
    word-break: break-word;
    color: #292524;
}

.diff-truncated-tip {
    margin: 0;
    padding: 8px 10px;
    font-size: 12px;
    color: #78716c;
    border-top: 1px dashed #d6d3d1;
    background: #fff;
}

.confirm-apply {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
    font-size: 13px;
    color: #44403c;
}

.confirm-apply input {
    width: 15px;
    height: 15px;
}

@media (max-width: 900px) {
    .form-grid,
    .diff-grid {
        grid-template-columns: 1fr;
    }

    .entry-select-head {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
