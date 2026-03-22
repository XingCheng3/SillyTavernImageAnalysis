<template>
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
            <div class="modal-header changelog-header">
                <div>
                    <p class="modal-eyebrow">Release Notes</p>
                    <h2 id="changelog-title">更新日志</h2>
                </div>
                <button type="button" class="close-button" aria-label="关闭更新日志" @click="$emit('close')">×</button>
            </div>

            <div class="modal-body changelog-body">
                <ul class="changelog-list">
                    <li v-for="entry in entries" :key="`${entry.time}-${entry.version}`" class="changelog-item">
                        <div class="changelog-meta">{{ entry.time }}&nbsp;&nbsp;{{ entry.version }}</div>
                        <div class="changelog-text">{{ entry.summary }}</div>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    entries: {
        type: Array,
        default: () => [],
    },
});

defineEmits(['close']);
</script>

<style scoped>
.changelog-modal {
    width: min(100%, 720px);
}

.changelog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.modal-eyebrow {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #a16207;
}

.changelog-body {
    padding-top: 18px;
}

.changelog-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.changelog-item {
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid #dfdbd3;
    background: linear-gradient(180deg, #ffffff 0%, #f8f6f1 100%);
}

.changelog-meta {
    font-size: 12px;
    font-weight: 800;
    color: #78716c;
    letter-spacing: 0.02em;
    margin-bottom: 6px;
}

.changelog-text {
    color: #1c1917;
    line-height: 1.6;
    font-size: 14px;
}
</style>
