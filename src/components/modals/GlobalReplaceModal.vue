<template>
    <div v-if="show" class="modal-backdrop">
        <div class="modal-content global-replace-modal">
            <div class="modal-header">
                <h2>全局替换文本</h2>
                <button @click="$emit('close')" class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <div class="replace-form">
                    <div class="form-group">
                        <label>原文本：</label>
                        <input type="text" v-model="replaceForm.originalText" @input="$emit('check')" placeholder="输入要被替换的文本" class="replace-input" />
                    </div>
                    <div class="form-group">
                        <label>新文本：</label>
                        <input type="text" v-model="replaceForm.newText" placeholder="输入替换后的文本" class="replace-input" />
                    </div>
                    <div v-if="replaceForm.originalText" class="occurrence-info">
                        <div class="occurrence-count">
                            <span class="count-number">{{ occurrenceCount }}</span>
                            <span class="count-text">处匹配</span>
                        </div>
                        <div v-if="occurrenceDetails.length > 0" class="occurrence-details">
                            <h4>出现位置：</h4>
                            <div class="occurrence-list">
                                <div v-for="detail in occurrenceDetails" :key="detail.field + detail.index" class="occurrence-item">
                                    <span class="field-name">{{ detail.fieldName }}</span>
                                    <span class="occurrence-preview">{{ detail.preview }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="$emit('execute')" class="action-button" :disabled="!replaceForm.originalText || !replaceForm.newText || occurrenceCount === 0">
                    执行替换 ({{ occurrenceCount }}处)
                </button>
                <button @click="$emit('close')" class="action-button secondary">取消</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, required: true },
    replaceForm: { type: Object, required: true },
    occurrenceCount: { type: Number, default: 0 },
    occurrenceDetails: { type: Array, default: () => [] },
});

defineEmits(['close', 'check', 'execute']);
</script>

<style scoped>
/* 使用父级的样式类，不做额外样式 */
</style>


