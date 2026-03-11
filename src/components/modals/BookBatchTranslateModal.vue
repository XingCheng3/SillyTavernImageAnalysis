<template>
    <div v-if="show" class="modal-backdrop">
        <div class="modal-content book-batch-translate-modal">
            <div class="modal-header">
                <h2>批量翻译世界书条目</h2>
                <button @click="$emit('close')" class="close-button" :disabled="isTranslating">&times;</button>
            </div>
            <div class="modal-body">
                <div v-if="!isTranslating" class="translation-setup">
                    <!-- 第一部分：字段选择 -->
                    <div class="setup-section">
                        <h3 class="section-title">
                            <span class="section-icon">📋</span>
                            要翻译的字段
                        </h3>
                        <div class="field-selection-grid">
                            <label class="field-checkbox">
                                <input type="checkbox" v-model="bookTranslateFields.name" />
                                <span class="field-label">条目名称</span>
                            </label>
                            <label class="field-checkbox">
                                <input type="checkbox" v-model="bookTranslateFields.keywords" />
                                <span class="field-label">关键词</span>
                            </label>
                            <label class="field-checkbox">
                                <input type="checkbox" v-model="bookTranslateFields.content" />
                                <span class="field-label">条目内容</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 第二部分：批次设置 -->
                    <div class="setup-section">
                        <h3 class="section-title">
                            <span class="section-icon">⚙️</span>
                            批次设置
                        </h3>
                        <div class="batch-config">
                            <label class="stream-toggle">
                                <input type="checkbox" v-model="useStreamTranslation" />
                                <span class="toggle-label">
                                    <strong>启用流式翻译</strong>
                                    <small>实时查看翻译进度和结果</small>
                                </span>
                            </label>
                            
                            <label class="stream-toggle concurrent-toggle">
                                <input type="checkbox" v-model="useConcurrentTranslation" :disabled="batchCount <= 1" />
                                <span class="toggle-label">
                                    <strong>并发翻译（多批次同时进行）</strong>
                                    <small>⚡ 显著提升翻译速度，仅在批次数 &gt; 1 时可用</small>
                                </span>
                            </label>
                            
                            <div class="batch-count-control">
                                <label class="control-label">拆分批次：</label>
                                <div class="count-input-group">
                                    <button @click="batchCount = Math.max(1, batchCount - 1)" class="count-btn">-</button>
                                    <input 
                                        type="number" 
                                        v-model.number="batchCount" 
                                        min="1" 
                                        :max="Math.max(1, selectedEntriesCount)" 
                                        class="count-input"
                                    />
                                    <button @click="batchCount = Math.min(selectedEntriesCount, batchCount + 1)" class="count-btn">+</button>
                                </div>
                                <div class="batch-info">
                                    <span class="info-item">选中: <strong>{{ selectedEntriesCount }}</strong> 个</span>
                                    <span class="info-divider">|</span>
                                    <span class="info-item">每批: <strong>~{{ itemsPerBatch }}</strong> 个</span>
                                    <span class="info-divider" v-if="batchCount > 1">|</span>
                                    <span class="info-item" v-if="batchCount > 1">模式: <strong>{{ useConcurrentTranslation ? '并发⚡' : '串行' }}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 第三部分：条目选择 -->
                    <div class="setup-section">
                        <div class="section-header">
                            <h3 class="section-title">
                                <span class="section-icon">📚</span>
                                选择条目
                            </h3>
                            <div class="section-actions">
                                <button @click="$emit('select-all-entries')" class="action-btn primary">全选</button>
                                <button @click="$emit('deselect-all-entries')" class="action-btn secondary">取消</button>
                            </div>
                        </div>
                        <div class="entries-list book-entry-selection-list">
                            <label v-for="(entry, index) in entries" :key="index" class="entry-item book-entry-option">
                                <div class="entry-item-main">
                                    <input type="checkbox" v-model="selectedEntries[index]" />
                                    <div class="entry-copy">
                                        <span class="entry-name">{{ entry.name || `条目 ${index + 1}` }}</span>
                                        <span class="entry-preview">{{ (entry.content || '暂无条目内容').slice(0, 90) }}{{ (entry.content || '').length > 90 ? '…' : '' }}</span>
                                    </div>
                                </div>
                                <span class="entry-index">#{{ index + 1 }}</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div v-else class="translation-progress">
                    <div class="progress-header">
                        <div class="progress-title">
                            <div class="gear-icon rotating"></div>
                            <h3>正在翻译世界书条目</h3>
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
                    
                    <!-- 实时预览区域 -->
                    <div v-if="streamResults && streamResults.length > 0" class="realtime-preview">
                        <div class="preview-header">
                            <h4>📋 实时翻译结果</h4>
                            <div class="preview-actions">
                                <button @click="selectAllPreview" class="preview-btn">全选</button>
                                <button @click="deselectAllPreview" class="preview-btn">取消</button>
                            </div>
                        </div>
                        <div class="preview-list">
                            <div v-for="(item, index) in streamResults" :key="index" class="preview-item">
                                <div class="preview-checkbox">
                                    <input type="checkbox" v-model="item.selected" :id="'preview-' + index" />
                                    <label :for="'preview-' + index" class="checkbox-label-only"></label>
                                </div>
                                <div class="preview-content">
                                    <div class="preview-title">
                                        <span class="entry-badge">{{ item.info.entryName }}</span>
                                        <span class="field-badge">{{ getFieldName(item.info.field) }}</span>
                                    </div>
                                    <div class="preview-compare">
                                        <div class="compare-col original-col">
                                            <div class="col-label">原文</div>
                                            <div class="col-text">{{ item.info.original }}</div>
                                        </div>
                                        <div class="compare-arrow">→</div>
                                        <div class="compare-col translated-col">
                                            <div class="col-label">译文</div>
                                            <div class="col-text">{{ item.result }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 失败批次列表（优先显示，支持单独重试） -->
                    <div v-if="failedBatches && failedBatches.length > 0" class="failed-batches">
                        <div class="failed-header">
                            <h4>❌ 部分内容翻译失败（{{ failedBatches.length }} 个批次）</h4>
                            <button @click="$emit('retry-all-failed')" class="retry-all-btn">🔄 重试所有</button>
                        </div>
                        <div class="failed-list">
                            <div v-for="batch in failedBatches" :key="batch.index" class="failed-batch-item">
                                <div class="batch-info-left">
                                    <span class="batch-badge">批次 {{ batch.index + 1 }}</span>
                                    <span class="batch-error">{{ batch.error || '未知错误' }}</span>
                                </div>
                                <button @click="$emit('retry-batch', batch.index)" class="retry-btn">
                                    🔄 重试
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 旧版错误列表（仅在没有失败批次信息时显示） -->
                    <div v-else-if="translationErrors.length > 0" class="translation-errors">
                        <div class="error-header-with-retry">
                            <p class="error-text">部分内容翻译失败：</p>
                            <button @click="$emit('retry')" class="retry-all-btn-inline">🔄 重试翻译</button>
                        </div>
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
                <button v-if="!isTranslating && !isError" @click="$emit('start')" class="action-button" :disabled="!hasSelections">开始翻译</button>
                <button v-if="isTranslating && !isComplete" @click="$emit('cancel')" class="action-button danger">取消翻译</button>
                <button v-if="isError && canRetry" @click="$emit('start')" class="action-button retry">重试翻译</button>
                <button v-if="isComplete && !isError" @click="$emit('close')" class="action-button">完成</button>
                <button v-if="isError" @click="$emit('close')" class="action-button">关闭</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    show: { type: Boolean, required: true },
    isTranslating: { type: Boolean, required: true },
    isError: { type: Boolean, required: true },
    canRetry: { type: Boolean, required: true },
    isComplete: { type: Boolean, required: true },
    hasSelections: { type: Boolean, required: true },
    apiSettings: { type: Object, required: true },
    formattedStartTime: { type: String, default: '' },
    formattedCurrentTime: { type: String, default: '' },
    translationDuration: { type: String, default: '' },
    translatedCount: { type: Number, default: 0 },
    totalToTranslate: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },
    translationErrors: { type: Array, default: () => [] },
    bookTranslateFields: { type: Object, required: true },
    entries: { type: Array, default: () => [] },
    selectedEntries: { type: Array, default: () => [] },
    streamResults: { type: Array, default: () => [] }, // 流式翻译实时结果
    failedBatches: { type: Array, default: () => [] }, // 失败的批次列表
});

defineEmits(['close', 'start', 'cancel', 'retry', 'select-all-entries', 'deselect-all-entries', 'show-error-details', 'retry-batch', 'retry-all-failed']);

// 字段名称映射
const getFieldName = (field) => {
    const names = {
        'name': '名称',
        'keywords': '关键词',
        'content': '内容'
    };
    return names[field] || field;
};

// 实时预览全选/取消
const selectAllPreview = () => {
    props.streamResults.forEach(item => item.selected = true);
};

const deselectAllPreview = () => {
    props.streamResults.forEach(item => item.selected = false);
};

// 批次设置
const useStreamTranslation = ref(true); // 默认启用流式翻译
const useConcurrentTranslation = ref(false); // 默认串行翻译
const batchCount = ref(1); // 默认不拆分

// 计算选中的条目数
const selectedEntriesCount = computed(() => {
    return props.selectedEntries.filter(Boolean).length;
});

// 计算每批的条目数
const itemsPerBatch = computed(() => {
    const count = selectedEntriesCount.value;
    const batches = Math.max(1, batchCount.value);
    return Math.ceil(count / batches);
});

// 暴露给父组件
defineExpose({
    useStreamTranslation,
    useConcurrentTranslation,
    batchCount
});
</script>

<style scoped>
.book-entry-selection-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    max-height: 360px;
    overflow: auto;
}

.book-entry-option {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid #dfdbd3;
    background: #fff;
    cursor: pointer;
}

.entry-item-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
    flex: 1;
}

.entry-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.entry-name {
    color: #1c1917;
    font-weight: 700;
    line-height: 1.5;
    word-break: break-word;
}

.entry-preview {
    color: #78716c;
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
}

.entry-index {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #f7f6f3;
    border: 1px solid #dfdbd3;
    color: #57534e;
    font-size: 12px;
    font-weight: 700;
}

@media (max-width: 900px) {
    .book-entry-selection-list {
        grid-template-columns: 1fr;
    }
}
</style>


