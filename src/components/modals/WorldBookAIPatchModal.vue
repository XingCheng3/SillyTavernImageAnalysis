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

                    <label class="replace-switch">
                        <input type="checkbox" v-model="form.keepStyle" />
                        <span>尽量保留原文风格</span>
                    </label>
                </div>

                <div v-if="preview" class="section-card preview-card">
                    <div class="preview-head">
                        <h3>改写预览</h3>
                        <span class="count-chip">{{ preview.changed ? '有变化' : '无变化' }}</span>
                    </div>
                    <p class="book-meta">
                        条目：<strong>{{ preview.entryTitle }}</strong>
                        ｜字段：<strong>{{ preview.patch.field }}</strong>
                    </p>

                    <div class="diff-grid">
                        <div class="diff-col">
                            <h4>改写前</h4>
                            <textarea class="diff-text" readonly :value="preview.beforeText"></textarea>
                        </div>
                        <div class="diff-col">
                            <h4>改写后</h4>
                            <textarea class="diff-text" readonly :value="preview.afterText"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="action-button secondary" @click="$emit('close')">取消</button>
                <button class="action-button" @click="$emit('generate')" :disabled="isGenerating || !form.instruction?.trim() || !form.entryId">
                    {{ isGenerating ? '生成中...' : '生成改写预览' }}
                </button>
                <button class="action-button" @click="$emit('apply')" :disabled="!preview || isGenerating">应用改写</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, required: true },
    isGenerating: { type: Boolean, default: false },
    form: { type: Object, required: true },
    preview: { type: Object, default: null },
    entries: { type: Array, default: () => [] },
});

defineEmits(['close', 'generate', 'apply']);
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

.replace-switch {
    margin-top: 8px;
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
    margin: 0 0 12px;
    color: #57534e;
    font-size: 13px;
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

@media (max-width: 900px) {
    .form-grid,
    .diff-grid {
        grid-template-columns: 1fr;
    }
}
</style>
