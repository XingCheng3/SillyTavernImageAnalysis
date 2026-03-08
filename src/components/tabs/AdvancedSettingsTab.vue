<template>
    <div class="tab-pane">
        <div class="batch-translate-section">
            <button @click="$emit('open-advanced-translate')" class="action-button">
                批量翻译高级设置
            </button>
        </div>

        <div class="data-item">
            <h3>系统提示词</h3>
            <textarea v-model="editableData.system_prompt" class="editable-textarea" placeholder="设置系统级别的指令或角色行为准则，用于指导AI的行为方式..."></textarea>
        </div>

        <div class="data-item">
            <h3>历史后指令</h3>
            <textarea v-model="editableData.post_history_instructions" class="editable-textarea" placeholder="在对话历史后追加的指令，用于特定的对话控制或行为引导..."></textarea>
        </div>

        <div class="data-item">
            <h3>备选问候语</h3>
            <div v-if="editableData.alternate_greetings && editableData.alternate_greetings.length">
                <div v-for="(greeting, index) in editableData.alternate_greetings" :key="index"
                    class="alternate-greeting">
                    <textarea v-model="editableData.alternate_greetings[index]" class="editable-textarea" :placeholder="`备选问候语 ${index + 1}：提供一个不同的开场白或问候方式...`"></textarea>
                    <button @click="$emit('remove-alternate', index)" class="small-button danger">删除</button>
                </div>
                <button @click="$emit('add-alternate')" class="small-button">添加问候语</button>
            </div>
            <div v-else>
                <p>无备选问候语</p>
                <button @click="$emit('add-alternate')" class="small-button">添加问候语</button>
            </div>
        </div>

        <div class="data-item">
            <h3>创建者备注</h3>
            <textarea v-model="editableData.creator_notes" class="editable-textarea" placeholder="记录创建者的备注信息、版本更新说明、设计思路或使用建议..."></textarea>
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


