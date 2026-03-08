<template>
    <div v-if="show" class="modal-backdrop">
        <div class="modal-content error-modal">
            <div class="modal-header">
                <h2>{{ errorModal.title || '提示' }}</h2>
                <button @click="$emit('close')" class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <div class="error-summary">
                    <div class="error-row"><span class="row-label">错误代码：</span><span class="row-value">{{ errorModal.code || '-' }}</span></div>
                    <div class="error-row" v-if="errorModal.status"><span class="row-label">HTTP状态：</span><span class="row-value">{{ errorModal.status }} {{ errorModal.statusText || '' }}</span></div>
                    <div class="error-message">{{ errorModal.message }}</div>
                    <div class="error-suggest" v-if="errorModal.suggestions && errorModal.suggestions.length">
                        <ul>
                            <li v-for="(s, i) in errorModal.suggestions" :key="i">{{ s }}</li>
                        </ul>
                    </div>
                    <details v-if="errorModal.details">
                        <summary>查看原始错误</summary>
                        <pre>{{ typeof errorModal.details === 'string' ? errorModal.details : JSON.stringify(errorModal.details, null, 2) }}</pre>
                    </details>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="$emit('close')" class="action-button">确定</button>
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    show: { type: Boolean, required: true },
    errorModal: { type: Object, required: true },
});

defineEmits(['close']);
</script>

<style scoped>
/* 使用父级的样式类，不做额外样式 */
</style>


