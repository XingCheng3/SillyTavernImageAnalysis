<template>
    <div class="tab-pane basic-tab">
        <div class="tab-intro-card">
            <div>
                <p class="eyebrow">基本信息</p>
                <h3>先把角色核心印象写清楚</h3>
                <p class="intro-text">
                    这一页决定角色的大部分“第一印象”。推荐顺序：先写<strong>描述</strong>和<strong>性格</strong>，再补<strong>场景</strong>、<strong>首次问候</strong>和<strong>示例对话</strong>。
                </p>
            </div>
            <div class="intro-actions">
                <button @click="$emit('open-batch-translate')" class="action-button">
                    批量翻译本页
                </button>
                <button @click="$emit('open-global-replace')" class="action-button global-replace-btn">
                    全局替换文本
                </button>
            </div>
        </div>

        <div class="field-grid">
            <div class="data-item emphasis-card">
                <div class="field-header">
                    <h3>描述</h3>
                    <span class="field-tip">外貌、身份、背景、关系</span>
                </div>
                <p class="field-help">写“角色是什么样的人”，尽量覆盖外观、身份定位、背景故事和关键设定。</p>
                <textarea v-model="editableData.description" class="editable-textarea" placeholder="详细描述角色的外貌、身份、背景故事、能力边界以及重要设定……"></textarea>
            </div>

            <div class="data-item emphasis-card">
                <div class="field-header">
                    <h3>性格</h3>
                    <span class="field-tip">行为方式与说话风格</span>
                </div>
                <p class="field-help">这里比“描述”更偏行为侧。适合写情绪反应、语言风格、价值观和习惯动作。</p>
                <textarea v-model="editableData.personality" class="editable-textarea" placeholder="描述角色的性格特点、行为习惯、说话方式、价值观与互动风格……"></textarea>
            </div>

            <div class="data-item compact-card">
                <div class="field-header">
                    <h3>场景</h3>
                    <span class="field-tip">对话发生在什么语境里</span>
                </div>
                <p class="field-help">适合写世界观、当前时间线、地点、故事开端或角色所处的特殊环境。</p>
                <textarea v-model="editableData.scenario" class="editable-textarea" placeholder="描述角色所处的环境、时代背景、当前情况或故事起点……"></textarea>
            </div>

            <div class="data-item compact-card">
                <div class="field-header">
                    <h3>首次问候</h3>
                    <span class="field-tip">决定开场体验</span>
                </div>
                <p class="field-help">建议写成有情境的开场白，不只是“你好”。让用户一打开就能感受到角色状态。</p>
                <textarea v-model="editableData.first_message" class="editable-textarea" placeholder="角色第一次见面时的问候语或开场白，可以体现角色性格和当前情境……"></textarea>
            </div>

            <div class="data-item full-span">
                <div class="field-header">
                    <h3>示例对话</h3>
                    <span class="field-tip">最好用多轮对话展示角色味道</span>
                </div>
                <p class="field-help">这是最能体现角色“像不像本人”的字段之一。建议写 2～4 段代表性互动，让模型学到说话节奏。</p>
                <textarea v-model="editableData.message_example" class="editable-textarea tall-textarea" placeholder="提供几段典型对话，展示角色的说话风格、互动方式、措辞习惯和节奏……"></textarea>
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
.basic-tab {
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
    background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
    border: 1px solid #dbeafe;
}

.eyebrow {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #2563eb;
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

.field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.data-item {
    padding: 18px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    background: #fff;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.04);
}

.emphasis-card {
    border-color: #cbd5e1;
}

.compact-card {
    min-height: 100%;
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
    color: #0f172a;
}

.field-tip {
    font-size: 12px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 4px 8px;
    border-radius: 999px;
}

.field-help {
    margin: 0 0 12px;
    color: #64748b;
    line-height: 1.6;
    font-size: 14px;
}

.tall-textarea {
    min-height: 220px;
}

@media (max-width: 900px) {
    .tab-intro-card {
        flex-direction: column;
    }

    .field-grid {
        grid-template-columns: 1fr;
    }
}
</style>
