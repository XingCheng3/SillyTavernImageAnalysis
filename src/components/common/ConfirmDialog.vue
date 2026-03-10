<template>
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content confirm-dialog" :class="[`is-${variant}`]" role="dialog" aria-modal="true">
            <div class="modal-header">
                <h3>{{ title }}</h3>
                <button class="close-button" type="button" @click="$emit('close')" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
                <p class="message">{{ message }}</p>
                <p v-if="description" class="description">{{ description }}</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="action-button secondary" @click="$emit('close')">{{ cancelText }}</button>
                <button type="button" class="action-button primary" :class="[`is-${variant}`]" @click="$emit('confirm')">{{ confirmText }}</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, default: false },
    title: { type: String, default: '请确认' },
    message: { type: String, default: '' },
    description: { type: String, default: '' },
    confirmText: { type: String, default: '确认' },
    cancelText: { type: String, default: '取消' },
    variant: { type: String, default: 'danger' },
});

defineEmits(['confirm', 'close']);
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.58);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 16px;
}

.modal-content {
    width: min(100%, 460px);
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
    overflow: hidden;
}

.modal-header,
.modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px;
}

.modal-header {
    border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
    color: #0f172a;
}

.close-button {
    border: none;
    background: transparent;
    font-size: 26px;
    line-height: 1;
    cursor: pointer;
    color: #64748b;
}

.modal-body {
    padding: 18px 20px 4px;
}

.message {
    margin: 0;
    color: #0f172a;
    font-size: 15px;
    line-height: 1.6;
}

.description {
    margin: 10px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
}

.modal-footer {
    justify-content: flex-end;
    border-top: 1px solid #e2e8f0;
}

.action-button {
    min-width: 88px;
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    cursor: pointer;
    padding: 10px 16px;
    font-size: 14px;
    transition: 0.2s ease;
}

.action-button.secondary {
    background: #fff;
    color: #334155;
}

.action-button.primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
}

.action-button.primary.is-danger {
    background: #dc2626;
    border-color: #dc2626;
}

.action-button.primary.is-warning {
    background: #d97706;
    border-color: #d97706;
}

.action-button:hover {
    filter: brightness(0.97);
}

@media (max-width: 640px) {
    .modal-footer {
        flex-direction: column-reverse;
    }

    .action-button {
        width: 100%;
    }
}
</style>
