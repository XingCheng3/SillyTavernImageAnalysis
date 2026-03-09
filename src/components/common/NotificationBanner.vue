<template>
    <div v-if="show" class="notice-banner" :class="`notice-${type}`">
        <div class="notice-content">
            <strong class="notice-title">{{ title }}</strong>
            <p class="notice-message">{{ message }}</p>
        </div>
        <button class="notice-close" @click="$emit('close')" aria-label="关闭提示">×</button>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, default: false },
    type: { type: String, default: 'info' },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
});

defineEmits(['close']);
</script>

<style scoped>
.notice-banner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    margin: 16px 0;
    border: 1px solid transparent;
}

.notice-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.notice-title {
    font-size: 14px;
    color: #0f172a;
}

.notice-message {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    font-size: 14px;
}

.notice-close {
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
}

.notice-info {
    background: #eff6ff;
    border-color: #bfdbfe;
}

.notice-success {
    background: #ecfdf5;
    border-color: #a7f3d0;
}

.notice-warning {
    background: #fffbeb;
    border-color: #fde68a;
}

.notice-error {
    background: #fef2f2;
    border-color: #fecaca;
}
</style>
