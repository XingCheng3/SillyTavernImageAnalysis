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
                        <li>选择条目与改写范围（条目 / 段落 / 字段）</li>
                        <li>输入改写指令，点击“生成改写预览”</li>
                        <li>确认前后差异后再应用（应用前建议保留快照）</li>
                    </ol>
                </div>

                <div class="section-card">
                    <h3>改写设置</h3>
                    <div class="form-grid">
                        <label class="field full">
                            <span>目标条目</span>
                            <select v-model="form.entryId" class="editable-input">
                                <option v-for="(entry, index) in entries" :key="entry.id ?? index" :value="String(entry.id)">
                                    {{ index + 1 }}. {{ entry.name || entry.comment || `条目 ${index + 1}` }}（id: {{ entry.id }}）
                                </option>
                            </select>
                        </label>

                        <label class="field">
                            <span>改写范围</span>
                            <select v-model="form.scope" class="editable-input">
                                <option value="entry">整条内容</option>
                                <option value="paragraph">指定段落</option>
                                <option value="field">指定字段</option>
                            </select>
                        </label>

                        <label class="field">
                            <span>改写模式</span>
                            <select v-model="form.mode" class="editable-input">
                                <option value="rewrite">重写</option>
                                <option value="replace">替换</option>
                                <option value="append">追加</option>
                                <option value="prepend">前置追加</option>
                            </select>
                        </label>

                        <label class="field" v-if="form.scope === 'paragraph'">
                            <span>段落索引（从 0 开始）</span>
                            <input v-model.number="form.paragraphIndex" type="number" min="0" class="editable-input" />
                        </label>

                        <div class="field full paragraph-picker" v-if="form.scope === 'paragraph'">
                            <span>段落候选（点击快速选择）</span>
                            <div class="paragraph-list" v-if="selectedEntryParagraphs.length">
                                <button
                                    v-for="(paragraph, idx) in selectedEntryParagraphs"
                                    :key="idx"
                                    type="button"
                                    class="paragraph-chip"
                                    :class="{ active: Number(form.paragraphIndex) === idx }"
                                    @click="form.paragraphIndex = idx"
                                >
                                    <strong>#{{ idx }}</strong>
                                    <span>{{ paragraph.slice(0, 56) }}{{ paragraph.length > 56 ? '…' : '' }}</span>
                                </button>
                            </div>
                            <p v-else class="paragraph-empty">当前条目没有可识别段落，请先补充内容再改写。</p>
                        </div>

                        <label class="field" v-if="form.scope === 'field'">
                            <span>字段</span>
                            <select v-model="form.field" class="editable-input">
                                <option value="content">content（正文）</option>
                                <option value="comment">comment（标题）</option>
                                <option value="name">name（名称）</option>
                                <option value="keysText">keysText（关键词）</option>
                            </select>
                        </label>

                        <label class="field full">
                            <span>改写指令（必填）</span>
                            <textarea
                                v-model="form.instruction"
                                class="editable-textarea"
                                placeholder="例如：保持设定不变，把这段改成更有压迫感的战前动员语气，并补充关键势力关系。"
                            ></textarea>
                        </label>
                    </div>

                    <div class="switch-stack">
                        <label class="replace-switch">
                            <input type="checkbox" v-model="form.keepStyle" />
                            <span>尽量保留原文风格</span>
                        </label>
                        <label class="replace-switch">
                            <input type="checkbox" v-model="form.allowRelatedEntries" />
                            <span>允许联动修改相关条目（实验中）</span>
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
                    </p>
                    <p v-if="preview.summary" class="preview-summary">{{ preview.summary }}</p>

                    <div v-if="preview.planner?.targets?.length" class="planner-card">
                        <h4>联动条目规划</h4>
                        <ul>
                            <li v-for="target in preview.planner.targets" :key="target.entryId">
                                <strong>{{ target.entryId }}</strong>
                                <span v-if="target.reason">：{{ target.reason }}</span>
                            </li>
                        </ul>
                    </div>

                    <div v-for="item in preview.entryPreviews" :key="`${item.entryId}-${item.field}`" class="entry-preview-card">
                        <div class="entry-preview-head">
                            <div>
                                <strong>{{ item.entryTitle }}</strong>
                                <p>字段：{{ item.field }} ｜ 操作数：{{ item.operations?.length || 0 }}</p>
                            </div>
                            <span class="count-chip small">{{ item.changed ? '已变更' : '无变化' }}</span>
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
                <button class="action-button" @click="$emit('generate')" :disabled="isGenerating || !form.instruction?.trim() || !form.entryId">
                    {{ isGenerating ? '生成中...' : '生成改写预览' }}
                </button>
                <button class="action-button" @click="$emit('apply')" :disabled="!preview || isGenerating || !form.confirmReviewedDiff">应用改写</button>
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

const selectedEntryParagraphs = computed(() => {
    const target = String(props.form?.entryId || '');
    if (!target) return [];

    const entry = (props.entries || []).find(item => String(item?.id) === target);
    if (!entry) return [];

    return String(entry.content || '')
        .split(/\n{2,}/)
        .map(v => v.trim())
        .filter(Boolean);
});
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

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
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

.paragraph-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}

.paragraph-chip {
    border: 1px solid #dfdbd3;
    border-radius: 10px;
    padding: 8px 10px;
    background: #fafaf9;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #44403c;
    cursor: pointer;
}

.paragraph-chip strong {
    font-size: 12px;
}

.paragraph-chip span {
    font-size: 12px;
    color: #78716c;
    line-height: 1.4;
}

.paragraph-chip.active {
    border-color: #93c5fd;
    background: #eff6ff;
}

.paragraph-empty {
    margin: 0;
    font-size: 12px;
    color: #a8a29e;
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

.planner-card,
.entry-preview-card {
    border: 1px solid #e7e5e4;
    border-radius: 14px;
    padding: 14px;
    background: #fcfcfb;
    margin-top: 14px;
}

.planner-card h4 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #292524;
}

.planner-card ul {
    margin: 0;
    padding-left: 18px;
    color: #57534e;
    line-height: 1.7;
}

.entry-preview-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.entry-preview-head p {
    margin: 4px 0 0;
    color: #78716c;
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
    .diff-grid,
    .paragraph-list {
        grid-template-columns: 1fr;
    }
}
</style>
