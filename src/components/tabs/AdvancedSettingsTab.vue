<template>
    <div class="tab-pane advanced-tab">
        <div class="tab-intro-card warning-tone">
            <div>
                <p class="eyebrow">高级设置</p>
                <h3>低频但高影响的角色行为控制区</h3>
                <p class="intro-text">
                    这里的字段通常比“基本信息”更强势。建议先把角色主体内容写稳，再回来调系统提示词、后置指令和多开场问候。
                </p>
            </div>
            <div class="intro-actions">
                <button @click="$emit('open-advanced-translate')" class="action-button">
                    批量翻译高级设置
                </button>
            </div>
        </div>

        <div class="advanced-grid">
            <div class="data-item full-span">
                <div class="field-header">
                    <h3>系统提示词</h3>
                    <span class="field-tip high-impact">高影响</span>
                </div>
                <p class="field-help">用于给模型一个稳定的上层行为约束。建议写规则、边界和整体行为基调，而不是重复角色描述。</p>
                <textarea v-model="editableData.system_prompt" class="editable-textarea tall-textarea" placeholder="设置系统级指令、角色行为规则、内容边界与稳定约束……"></textarea>
            </div>

            <div class="data-item full-span">
                <div class="field-header">
                    <h3>历史后指令</h3>
                    <span class="field-tip">适合补充收尾规则</span>
                </div>
                <p class="field-help">这是跟在对话历史后面的追加控制。适合做格式要求、语气提醒或某些特定输出限制。</p>
                <textarea v-model="editableData.post_history_instructions" class="editable-textarea" placeholder="在对话历史后追加的指令，用于格式控制、行为提醒或特定场景限制……"></textarea>
            </div>

            <div class="data-item full-span">
                <div class="field-header">
                    <h3>备选问候语</h3>
                    <span class="field-tip">增强开场多样性</span>
                </div>
                <p class="field-help">适合准备多个不同语境的开场白。建议每条都有明显差异，不要只改几个词。</p>

                <div v-if="editableData.alternate_greetings && editableData.alternate_greetings.length" class="greetings-list">
                    <div v-for="(greeting, index) in editableData.alternate_greetings" :key="index" class="alternate-greeting card-row">
                        <div class="greeting-meta">
                            <span class="greeting-index">问候语 {{ index + 1 }}</span>
                            <button @click="$emit('remove-alternate', index)" class="small-button danger">删除</button>
                        </div>
                        <textarea v-model="editableData.alternate_greetings[index]" class="editable-textarea" :placeholder="`备选问候语 ${index + 1}：提供一个不同的开场白或问候方式……`"></textarea>
                    </div>
                    <button @click="$emit('add-alternate')" class="small-button">添加问候语</button>
                </div>
                <div v-else class="empty-inline-card">
                    <div>
                        <strong>还没有备选问候语</strong>
                        <p>如果你希望角色每次开场更自然、更有变化，可以先加 1～3 条不同风格的问候语。</p>
                    </div>
                    <button @click="$emit('add-alternate')" class="small-button">添加问候语</button>
                </div>
            </div>

            <div class="data-item full-span">
                <div class="field-header">
                    <h3>创建者备注</h3>
                    <span class="field-tip">给后续维护看的信息</span>
                </div>
                <p class="field-help">适合记录版本说明、设计思路、适用模型、翻译状态或后续待办，不建议放用户对话必须依赖的内容。</p>
                <textarea v-model="editableData.creator_notes" class="editable-textarea" placeholder="记录创建者备注、版本变更、设计思路、适用说明或维护信息……"></textarea>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    editableData: { type: Object, required: true },
});
</script>

<style scoped>
.advanced-tab {
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
    border: 1px solid #dfdbd3;
    background: linear-gradient(180deg, #ffffff 0%, #f7f6f3 100%);
}

.warning-tone {
    border-color: #d6d3d1;
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

.advanced-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}

.data-item {
    padding: 18px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    background: #fff;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.04);
}

.full-span {
    grid-column: 1 / -1;
}

.field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.field-header h3 {
    margin: 0;
}

.field-tip {
    font-size: 12px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 4px 8px;
    border-radius: 999px;
}

.high-impact {
    color: #b45309;
    background: #fff7ed;
    border-color: #fed7aa;
}

.field-help {
    margin: 0 0 12px;
    color: #64748b;
    line-height: 1.6;
    font-size: 14px;
}

.tall-textarea {
    min-height: 180px;
}

.greetings-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.card-row {
    padding: 14px;
    border-radius: 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
}

.greeting-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
}

.greeting-index {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
}

.empty-inline-card {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    border-radius: 14px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
}

.empty-inline-card strong {
    display: block;
    margin-bottom: 6px;
    color: #0f172a;
}

.empty-inline-card p {
    margin: 0;
    color: #64748b;
    line-height: 1.6;
}

@media (max-width: 900px) {
    .tab-intro-card,
    .empty-inline-card,
    .greeting-meta {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
