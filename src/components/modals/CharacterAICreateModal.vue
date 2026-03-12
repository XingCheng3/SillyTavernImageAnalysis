<template>
    <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
        <div class="modal-content character-ai-create-modal">
            <div class="modal-header">
                <h2>从 0 创建角色卡（AI）</h2>
                <button @click="$emit('close')" class="close-button">&times;</button>
            </div>

            <div class="modal-body">
                <div class="section-card tips-card">
                    <h3>创建流程</h3>
                    <ol>
                        <li>输入核心提示词与风格要求</li>
                        <li>AI 生成角色卡草稿（含世界书）</li>
                        <li>应用草稿后进入编辑台继续微调</li>
                        <li>可上传/替换封面后导出角色卡 PNG</li>
                    </ol>
                </div>

                <div class="section-card">
                    <h3>生成输入</h3>
                    <div class="form-grid">
                        <label class="field full">
                            <span>核心提示词（必填）</span>
                            <textarea
                                v-model="form.corePrompt"
                                class="editable-textarea"
                                placeholder="例如：请创建一位异界降临校园战斗题材女主，核心矛盾是身份保密与命运对抗……"
                            ></textarea>
                        </label>

                        <label class="field">
                            <span>题材</span>
                            <input v-model="form.genre" class="editable-input" placeholder="异世界 / 学园 / 战斗" />
                        </label>

                        <label class="field">
                            <span>文风</span>
                            <input v-model="form.style" class="editable-input" placeholder="偏轻小说、节奏快、冲突强" />
                        </label>

                        <label class="field full">
                            <span>关系基调</span>
                            <input v-model="form.relationshipTone" class="editable-input" placeholder="例如：嘴硬互怼到并肩作战" />
                        </label>

                        <label class="field">
                            <span>生成策略</span>
                            <select v-model="form.generationMode" class="editable-input">
                                <option value="two_step">两阶段（先骨架再扩写，推荐）</option>
                                <option value="single">单阶段（更快）</option>
                            </select>
                        </label>

                        <label class="field">
                            <span>世界书条目数</span>
                            <input v-model.number="form.targetEntryCount" type="number" min="1" max="80" class="editable-input" />
                        </label>

                        <label class="field">
                            <span>开场分支数</span>
                            <input v-model.number="form.openingCount" type="number" min="0" max="10" class="editable-input" />
                        </label>

                        <label class="field full">
                            <span>附加要求（可选）</span>
                            <textarea
                                v-model="form.notes"
                                class="editable-textarea"
                                placeholder="例如：保留成长弧线；世界规则要有代价；避免空洞百科式设定。"
                            ></textarea>
                        </label>
                    </div>

                    <label class="replace-switch">
                        <input type="checkbox" v-model="form.applyOpeningsToGreetings" />
                        <span>将开场分支自动同步到开场白（first_message + alternate_greetings）</span>
                    </label>
                </div>

                <div class="section-card preview-card" v-if="draft">
                    <div class="preview-head">
                        <h3>草稿预览</h3>
                        <div class="preview-counts">
                            <span class="count-chip">{{ draft.worldbookDraft.entries.length }} 条世界书</span>
                            <span class="count-chip" v-if="draft.worldbookDraft.openings?.length">{{ draft.worldbookDraft.openings.length }} 个开场分支</span>
                        </div>
                    </div>
                    <p class="book-meta">角色名：<strong>{{ draft.card.name }}</strong></p>
                    <p class="draft-line">首条开场白：{{ draft.card.first_message || '（空）' }}</p>

                    <div class="warnings" v-if="warnings?.length">
                        <h4>校验提醒（{{ warnings.length }}）</h4>
                        <ul>
                            <li v-for="(warning, idx) in warnings" :key="idx">{{ warning.message }}</li>
                        </ul>
                    </div>

                    <div class="retry-failures" v-if="retryFailures?.length">
                        <div class="retry-header">
                            <h4>待补全失败条目（{{ retryFailures.length }}）</h4>
                            <button class="small-button" @click="$emit('retry-failed')" :disabled="isGenerating">重试失败条目</button>
                        </div>
                        <ul>
                            <li v-for="item in retryFailures" :key="item.entryId">
                                <strong>{{ item.entryId }}</strong>
                                <span v-if="item.entryTitle">（{{ item.entryTitle }}）</span>
                                ：{{ item.message }}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <p class="stage-tip" v-if="isGenerating && generationStageLabel">{{ generationStageLabel }}</p>
                <button class="action-button secondary" @click="$emit('close')">取消</button>
                <button class="action-button" @click="$emit('generate')" :disabled="isGenerating || !form.corePrompt?.trim()">
                    {{ isGenerating ? '生成中...' : '生成角色草稿' }}
                </button>
                <button class="action-button" @click="$emit('apply')" :disabled="!draft || isGenerating || retryFailures?.length">应用并进入编辑</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, required: true },
    isGenerating: { type: Boolean, default: false },
    generationStageLabel: { type: String, default: '' },
    form: { type: Object, required: true },
    draft: { type: Object, default: null },
    warnings: { type: Array, default: () => [] },
    retryFailures: { type: Array, default: () => [] },
});

defineEmits(['close', 'generate', 'retry-failed', 'apply']);
</script>

<style scoped>
.character-ai-create-modal {
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
    margin: 0;
    color: #57534e;
    font-size: 13px;
}

.draft-line {
    margin: 8px 0 0;
    color: #57534e;
    font-size: 13px;
    line-height: 1.6;
}

.warnings {
    margin-top: 10px;
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

.retry-failures {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    border-radius: 10px;
}

.retry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.retry-header h4 {
    margin: 0;
    font-size: 13px;
    color: #991b1b;
}

.retry-failures ul {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.6;
    color: #7f1d1d;
}

.stage-tip {
    margin: 0 auto 0 0;
    font-size: 12px;
    color: #57534e;
    background: #f5f5f4;
    border: 1px solid #d6d3d1;
    border-radius: 999px;
    padding: 6px 10px;
}

@media (max-width: 900px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
