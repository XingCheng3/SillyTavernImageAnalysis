<template>
    <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
        <div class="modal-content worldbook-ai-modal">
            <div class="modal-header">
                <h2>AI 代写世界书</h2>
                <button @click="$emit('close')" class="close-button">&times;</button>
            </div>

            <div class="modal-body">
                <div class="section-card tips-card">
                    <h3>蓝绿灯规则（已冻结）</h3>
                    <div class="light-grid">
                        <div class="light-item blue">
                            <strong>蓝灯</strong>
                            <p>必须命中关键词才会载入上下文（关键词至少 1 个）。</p>
                        </div>
                        <div class="light-item green">
                            <strong>绿灯</strong>
                            <p>直接载入上下文，适合世界观基础规则和常驻设定。</p>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <h3>生成输入</h3>
                    <div class="form-grid">
                        <label class="field full">
                            <span>世界观主线（必填）</span>
                            <textarea
                                v-model="form.premise"
                                class="editable-textarea"
                                placeholder="例如：现代地球被裂缝入侵，联邦学校通过契灵体系培养战斗人才……"
                            ></textarea>
                        </label>

                        <label class="field">
                            <span>题材</span>
                            <input v-model="form.genre" class="editable-input" placeholder="异世界 / 学院 / 战斗" />
                        </label>

                        <label class="field">
                            <span>文风</span>
                            <input v-model="form.style" class="editable-input" placeholder="高张力、快节奏、偏轻小说" />
                        </label>

                        <label class="field full">
                            <span>主角定位</span>
                            <input v-model="form.protagonist" class="editable-input" placeholder="例如：异界降临者 + 因果律道具持有者" />
                        </label>

                        <label class="field">
                            <span>目标条目数</span>
                            <input v-model.number="form.targetEntryCount" type="number" min="1" max="80" class="editable-input" />
                        </label>

                        <label class="field">
                            <span>开场白分支数</span>
                            <input v-model.number="form.openingCount" type="number" min="0" max="10" class="editable-input" />
                        </label>

                        <label class="field full">
                            <span>附加要求（可选）</span>
                            <textarea
                                v-model="form.notes"
                                class="editable-textarea"
                                placeholder="例如：女主分支必须互斥；组织条目要有行动逻辑；地点条目包含氛围与风险等级"
                            ></textarea>
                        </label>
                    </div>

                    <label class="replace-switch">
                        <input type="checkbox" v-model="form.replaceExisting" />
                        <span>应用时替换现有世界书条目（不勾选则追加）</span>
                    </label>

                    <label class="replace-switch">
                        <input type="checkbox" v-model="form.applyOpeningsToGreetings" />
                        <span>将开场分支同步到开场白（first_message + alternate_greetings）</span>
                    </label>
                </div>

                <div v-if="draft" class="section-card preview-card">
                    <div class="preview-head">
                        <h3>草稿预览</h3>
                        <div class="preview-counts">
                            <span class="count-chip">{{ draft.entries.length }} 条条目</span>
                            <span class="count-chip" v-if="draft.openings?.length">{{ draft.openings.length }} 个开场分支</span>
                        </div>
                    </div>
                    <p class="book-meta">
                        世界书：<strong>{{ draft.book?.name || '未命名' }}</strong>
                        <span v-if="draft.book?.description">｜{{ draft.book.description }}</span>
                    </p>

                    <div class="warnings" v-if="warnings?.length">
                        <h4>校验提醒（{{ warnings.length }}）</h4>
                        <ul>
                            <li v-for="(warning, idx) in warnings" :key="idx">{{ warning.message }}</li>
                        </ul>
                    </div>

                    <div class="preview-list">
                        <div v-for="(entry, idx) in draft.entries.slice(0, 12)" :key="entry.id" class="preview-item">
                            <div class="row-top">
                                <strong>{{ idx + 1 }}. {{ entry.title }}</strong>
                                <span class="light-tag" :class="entry.light">{{ entry.light === 'green' ? '绿灯' : '蓝灯' }}</span>
                            </div>
                            <div class="row-sub">
                                <span>关键词：{{ entry.keywords.length }}</span>
                                <span>顺序：{{ entry.insertionOrder }}</span>
                                <span>深度：{{ entry.depth }}</span>
                            </div>
                        </div>
                    </div>
                    <p v-if="draft.entries.length > 12" class="ellipsis-tip">仅预览前 12 条，应用后可在世界书页继续逐条微调。</p>

                    <div class="opening-preview" v-if="draft.openings?.length">
                        <h4>开场分支预览</h4>
                        <div class="opening-list">
                            <div v-for="opening in draft.openings" :key="opening.id" class="opening-item">
                                <div class="opening-head">
                                    <strong>{{ opening.title }}</strong>
                                    <span class="opening-id">{{ opening.id }}</span>
                                </div>
                                <p>{{ opening.text || '（空）' }}</p>
                                <div class="opening-links">
                                    <span>启用：{{ opening.enableEntryIds?.join(', ') || '无' }}</span>
                                    <span>禁用：{{ opening.disableEntryIds?.join(', ') || '无' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="action-button secondary" @click="$emit('close')">取消</button>
                <button class="action-button" @click="$emit('generate')" :disabled="isGenerating || !form.premise?.trim()">
                    {{ isGenerating ? '生成中...' : '生成草稿' }}
                </button>
                <button class="action-button" @click="$emit('apply')" :disabled="!draft || isGenerating">应用草稿</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, required: true },
    isGenerating: { type: Boolean, default: false },
    form: { type: Object, required: true },
    draft: { type: Object, default: null },
    warnings: { type: Array, default: () => [] },
});

defineEmits(['close', 'generate', 'apply']);
</script>

<style scoped>
.worldbook-ai-modal {
    width: min(100%, 1120px);
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

.light-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.light-item {
    border-radius: 12px;
    border: 1px solid #dfdbd3;
    padding: 10px 12px;
    background: #fafaf9;
}

.light-item p {
    margin: 6px 0 0;
    font-size: 13px;
    color: #57534e;
    line-height: 1.6;
}

.light-item.blue {
    border-color: #bfdbfe;
    background: #eff6ff;
}

.light-item.green {
    border-color: #bbf7d0;
    background: #f0fdf4;
}

.replace-switch {
    margin-top: 10px;
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
    gap: 8px;
    margin-bottom: 8px;
}

.preview-counts {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
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

.warnings {
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #fde68a;
    background: #fffbeb;
    border-radius: 10px;
}

.warnings h4 {
    margin: 0 0 8px;
    font-size: 13px;
}

.warnings ul {
    margin: 0;
    padding-left: 18px;
    color: #78350f;
    font-size: 12px;
    line-height: 1.6;
}

.preview-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.preview-item {
    border: 1px solid #dfdbd3;
    border-radius: 12px;
    padding: 10px;
    background: #fafaf9;
}

.row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.row-top strong {
    font-size: 13px;
    color: #1c1917;
}

.light-tag {
    font-size: 11px;
    font-weight: 700;
    border-radius: 999px;
    padding: 2px 8px;
    border: 1px solid #d6d3d1;
}

.light-tag.blue {
    background: #dbeafe;
    color: #1d4ed8;
    border-color: #93c5fd;
}

.light-tag.green {
    background: #dcfce7;
    color: #166534;
    border-color: #86efac;
}

.row-sub {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    color: #78716c;
}

.ellipsis-tip {
    margin: 10px 0 0;
    font-size: 12px;
    color: #78716c;
}

.opening-preview {
    margin-top: 14px;
    border-top: 1px dashed #d6d3d1;
    padding-top: 12px;
}

.opening-preview h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #44403c;
}

.opening-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.opening-item {
    border: 1px solid #dfdbd3;
    border-radius: 12px;
    padding: 10px;
    background: #fafaf9;
}

.opening-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.opening-id {
    font-size: 11px;
    color: #78716c;
    background: #f5f5f4;
    border: 1px solid #d6d3d1;
    border-radius: 999px;
    padding: 2px 8px;
}

.opening-item p {
    margin: 8px 0;
    font-size: 13px;
    color: #57534e;
    line-height: 1.6;
}

.opening-links {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: #78716c;
}

@media (max-width: 900px) {
    .form-grid,
    .light-grid,
    .preview-list,
    .opening-list {
        grid-template-columns: 1fr;
    }
}
</style>
