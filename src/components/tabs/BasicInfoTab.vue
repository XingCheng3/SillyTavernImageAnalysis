<template>
    <div class="tab-pane">
        <div class="batch-translate-section">
            <button @click="$emit('open-batch-translate')" class="action-button">
                批量翻译所有字段
            </button>
            <button @click="$emit('open-global-replace')" class="action-button global-replace-btn">
                全局替换文本
            </button>
        </div>

        <div class="data-item">
            <h3>描述</h3>
            <textarea v-model="editableData.description" class="editable-textarea" placeholder="详细描述角色的外貌、身份、背景故事等基本信息..."></textarea>
        </div>

        <div class="data-item">
            <h3>性格</h3>
            <textarea v-model="editableData.personality" class="editable-textarea" placeholder="描述角色的性格特点、行为习惯、说话方式、价值观等性格特征..."></textarea>
        </div>

        <div class="data-item">
            <h3>场景</h3>
            <textarea v-model="editableData.scenario" class="editable-textarea" placeholder="描述角色所处的环境、时代背景、当前情况或故事设定..."></textarea>
        </div>

        <div class="data-item">
            <h3>首次问候</h3>
            <textarea v-model="editableData.first_message" class="editable-textarea" placeholder="角色第一次见面时的问候语或开场白，可以体现角色的性格和当前情境..."></textarea>
        </div>

        <div class="data-item">
            <h3>示例对话</h3>
            <textarea v-model="editableData.message_example" class="editable-textarea" placeholder="提供一些角色的典型对话示例，展示角色的说话风格和互动方式..."></textarea>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    editableData: { type: Object, required: true },
});
</script>

<style scoped>
/* 复用父级样式类名，无额外样式 */
</style>


