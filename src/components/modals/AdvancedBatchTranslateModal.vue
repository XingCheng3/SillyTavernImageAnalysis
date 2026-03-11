<template>
    <div v-if="show" class="modal-backdrop">
        <div class="modal-content advanced-batch-translate-modal">
            <div class="modal-header">
                <h2>批量翻译高级设置</h2>
                <button @click="$emit('close')" class="close-button" :disabled="isTranslating">&times;</button>
            </div>
            <div class="modal-body">
                <div v-if="!isTranslating">
                    <h3>选择要翻译的字段：</h3>
                    <div class="advanced-translate-options">
                        <div class="translate-field-options">
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="advancedTranslateFields.system_prompt" />
                                <span>系统提示词</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="advancedTranslateFields.post_history_instructions" />
                                <span>历史后指令</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="advancedTranslateFields.creator_notes" />
                                <span>作者备注</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="advancedTranslateFields.alternate_greetings" />
                                <span>备选问候语</span>
                            </label>
                        </div>
                        <div v-if="advancedTranslateFields.alternate_greetings" class="translate-entry-selection">
                            <h4>选择备选问候语：</h4>
                            <div class="entry-selection-actions">
                                <button @click="$emit('select-all-alt')" class="small-button">全选</button>
                                <button @click="$emit('deselect-all-alt')" class="small-button">取消全选</button>
                            </div>
                            <div v-if="Array.isArray(alternateGreetings) && alternateGreetings.length" class="entry-selection-list">
                                <label v-for="(g, idx) in alternateGreetings" :key="idx" class="entry-checkbox-label">
                                    <input type="checkbox" v-model="selectedAlternateGreetings[idx]" />
                                    <span>问候 {{ idx + 1 }}：{{ (g || '').slice(0, 50) }}{{ (g || '').length > 50 ? '...' : '' }}</span>
                                </label>
                            </div>
                            <div v-else class="no-entries-message">
                                <p>无备选问候语</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="translation-progress">
                    <div class="progress-header">
                        <div class="progress-title">
                            <div class="gear-icon rotating"></div>
                            <h3>正在翻译高级设置</h3>
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
                        <p class="progress-count">当前进度: {{ translatedCount }} / {{ totalToTranslate }}</p>
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
                        <p class="error-text">部分内容翻译失败：</p>
                        <ul>
                            <li v-for="error in translationErrors" :key="error.field">
                                <div class="error-item">
                                    <div class="error-main">{{ error.field }}: {{ error.message }}</div>
                                    <button v-if="error.details" @click="$emit('show-error-details', error.details)" class="error-details-btn" title="查看详细错误信息">详情</button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button v-if="!isTranslating && !isError" @click="$emit('start')" class="action-button" :disabled="!hasSelectedFields">开始翻译</button>
                <button v-if="isTranslating && !isComplete" @click="$emit('cancel')" class="action-button danger">取消翻译</button>
                <button v-if="isError && canRetry" @click="$emit('start')" class="action-button retry">重试翻译</button>
                <button v-if="isComplete && !isError" @click="$emit('close')" class="action-button">完成</button>
                <button v-if="isError" @click="$emit('close')" class="action-button">关闭</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, required: true },
    isTranslating: { type: Boolean, required: true },
    isError: { type: Boolean, required: true },
    canRetry: { type: Boolean, required: true },
    isComplete: { type: Boolean, required: true },
    hasSelectedFields: { type: Boolean, required: true },
    apiSettings: { type: Object, required: true },
    formattedStartTime: { type: String, default: '' },
    formattedCurrentTime: { type: String, default: '' },
    translationDuration: { type: String, default: '' },
    translatedCount: { type: Number, default: 0 },
    totalToTranslate: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },
    translationErrors: { type: Array, default: () => [] },
    advancedTranslateFields: { type: Object, required: true },
    alternateGreetings: { type: Array, default: () => [] },
    selectedAlternateGreetings: { type: Array, default: () => [] },
});

defineEmits(['close', 'start', 'cancel', 'retry', 'select-all-alt', 'deselect-all-alt', 'show-error-details']);
</script>

<style scoped>
/* 使用父级的样式类，不做额外样式 */
</style>


