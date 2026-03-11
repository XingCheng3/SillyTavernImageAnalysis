<template>
    <div v-if="show" class="modal-backdrop">
        <div class="modal-content batch-translate-modal">
            <div class="modal-header">
                <h2>批量翻译设置</h2>
                <button @click="$emit('close')" class="close-button" :disabled="isTranslating">&times;</button>
            </div>
            <div class="modal-body">
                <div v-if="!isTranslating">
                    <h3>选择要翻译的字段：</h3>
                    <div class="field-selection">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="selectedFields.name" />
                            <span>角色名称</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="selectedFields.description" />
                            <span>描述</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="selectedFields.personality" />
                            <span>性格</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="selectedFields.scenario" />
                            <span>场景</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="selectedFields.first_message" />
                            <span>首次问候</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="selectedFields.message_example" />
                            <span>示例对话</span>
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button @click="$emit('select-all')" class="small-button">全选</button>
                        <button @click="$emit('deselect-all')" class="small-button">取消全选</button>
                    </div>
                </div>
                <div v-else class="translation-progress">
                    <div class="progress-header">
                        <div class="progress-title">
                            <div class="gear-icon rotating"></div>
                            <h3>正在翻译</h3>
                        </div>
                        <div class="progress-model">
                            <span class="model-label">模型:</span>
                            <span class="model-name">{{ apiSettings.model }}</span>
                        </div>
                    </div>
                    <div class="progress-time-info">
                        <div class="time-item">
                            <span class="time-label">开始时间:</span>
                            <span class="time-value">{{ formattedStartTime }}</span>
                        </div>
                        <div class="time-item">
                            <span class="time-label">当前时间:</span>
                            <span class="time-value">{{ formattedCurrentTime }}</span>
                        </div>
                        <div class="time-item">
                            <span class="time-label">已用时长:</span>
                            <span class="time-value">{{ translationDuration }}</span>
                        </div>
                    </div>
                    <div class="progress-info">
                        <p class="current-field">当前字段: {{ currentTranslatingField }}</p>
                        <p class="progress-count">进度: {{ translatedCount }} / {{ totalFieldsToTranslate }}</p>
                    </div>
                    <div class="enhanced-progress-bar">
                        <div class="progress-track">
                            <div class="progress-fill" :style="{ width: progressPercentage + '%' }">
                                <div class="progress-shine"></div>
                            </div>
                        </div>
                        <div class="progress-percentage">{{ progressPercentage }}%</div>
                    </div>
                    <div v-if="translationErrors.length > 0" class="translation-errors">
                        <p class="error-text">部分字段翻译失败：</p>
                        <ul>
                            <li v-for="error in translationErrors" :key="error.field">
                                <div class="error-item">
                                    <div class="error-main">
                                        {{ error.field }}: {{ error.message }}
                                    </div>
                                    <button v-if="error.details" @click="$emit('show-error-details', error.details)" class="error-details-btn" title="查看详细错误信息">详情</button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button v-if="!isTranslating && !isTranslationError" @click="$emit('start')" class="action-button" :disabled="!hasSelectedFields">开始翻译</button>
                <button v-if="isTranslating && !isTranslationComplete" @click="$emit('cancel')" class="action-button danger">取消翻译</button>
                <button v-if="isTranslationError && canRetryTranslation" @click="$emit('start')" class="action-button retry">重试翻译</button>
                <button v-if="isTranslationComplete && !isTranslationError" @click="$emit('close')" class="action-button">完成</button>
                <button v-if="isTranslationError" @click="$emit('close')" class="action-button">关闭</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, required: true },
    isTranslating: { type: Boolean, required: true },
    isTranslationError: { type: Boolean, required: true },
    canRetryTranslation: { type: Boolean, required: true },
    isTranslationComplete: { type: Boolean, required: true },
    hasSelectedFields: { type: Boolean, required: true },
    selectedFields: { type: Object, required: true },
    apiSettings: { type: Object, required: true },
    formattedStartTime: { type: String, default: '' },
    formattedCurrentTime: { type: String, default: '' },
    translationDuration: { type: String, default: '' },
    currentTranslatingField: { type: String, default: '' },
    translatedCount: { type: Number, default: 0 },
    totalFieldsToTranslate: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },
    translationErrors: { type: Array, default: () => [] },
});

defineEmits(['close', 'start', 'cancel', 'retry', 'select-all', 'deselect-all', 'show-error-details']);
</script>

<style scoped>
/* 使用父级的样式类，不做额外样式 */
</style>


