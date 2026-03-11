<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content compare-modal">
            <div class="modal-header">
                <h2>
                    <span class="modal-icon">🔍</span>
                    翻译结果对比
                </h2>
                <button @click="close" class="close-button">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="compare-instructions">
                    <p>请查看翻译结果，选择要应用的字段。勾选的字段将使用翻译结果替换原文。</p>
                    <p class="failed-tip">失败项会以未勾选状态展示，仅用于提醒你哪些字段没有成功翻译。</p>
                </div>
                
                <!-- 翻译信息显示 -->
                <div v-if="modelName || translationDuration" class="translation-info">
                    <div class="info-item" v-if="modelName">
                        <span class="info-label">使用模型:</span>
                        <span class="info-value">{{ modelName }}</span>
                    </div>
                    <div class="info-item" v-if="translationStartTime">
                        <span class="info-label">开始时间:</span>
                        <span class="info-value">{{ translationStartTime }}</span>
                    </div>
                    <div class="info-item" v-if="translationDuration">
                        <span class="info-label">翻译耗时:</span>
                        <span class="info-value">{{ translationDuration }}</span>
                    </div>
                </div>
                
                <div class="compare-actions">
                    <button @click="selectAll" class="action-btn primary">全选</button>
                    <button @click="deselectAll" class="action-btn secondary">全不选</button>
                    <!-- <button @click="selectRecommended" class="action-btn success">智能推荐</button> -->
                </div>
                
                <div class="compare-list">
                    <div 
                        v-for="(item, index) in compareItems" 
                        :key="index"
                        class="compare-item"
                        :class="{ 'item-selected': item.selected }"
                    >
                        <div class="item-header">
                            <label class="selection-checkbox">
                                <input 
                                    type="checkbox" 
                                    v-model="item.selected"
                                    @change="updateSelection"
                                />
                                <span class="field-name">{{ item.entryName ? `${item.entryName} - ${getFieldDisplayName(item.fieldType || item.field)}` : getFieldDisplayName(item.field) }}</span>
                                <span class="field-badge" :class="item.type">{{ item.type }}</span>
                            </label>
                            
                            <div class="item-stats">
                                <span class="char-count">
                                    原文: {{ item.original.length }}字 → 译文: {{ item.translated.length }}字
                                </span>
                                <span class="change-indicator" :class="getChangeType(item.original, item.translated)">
                                    {{ getChangeText(item.original, item.translated) }}
                                </span>
                            </div>
                        </div>
                        
                        <div class="content-compare">
                            <div class="content-column original">
                                <h4>原文</h4>
                                <div class="content-box">{{ item.original || '(空)' }}</div>
                            </div>
                            
                            <div class="content-divider">
                                <div class="arrow-icon">→</div>
                            </div>
                            
                            <div class="content-column translated">
                                <h4>译文</h4>
                                <div class="content-box">{{ item.translated || '(空)' }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="summary-info">
                    <div class="selection-summary">
                        已选择 {{ selectedCount }} / {{ compareItems.length }} 个字段
                    </div>
                    <div class="estimated-changes">
                        预计更改 {{ estimatedChanges }} 个字段的内容
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button @click="previewChanges" class="action-button preview" :disabled="selectedCount === 0">
                    预览更改
                </button>
                <button @click="applySelected" class="action-button primary" :disabled="selectedCount === 0">
                    应用选中 ({{ selectedCount }})
                </button>
                <button @click="close" class="action-button secondary">取消</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
    show: Boolean,
    compareData: {
        type: Array,
        default: () => []
    },
    type: {
        type: String,
        default: 'basic' // 'basic' 或 'worldbook'
    },
    modelName: {
        type: String,
        default: ''
    },
    translationDuration: {
        type: String,
        default: ''
    },
    translationStartTime: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['close', 'apply', 'preview']);

const compareItems = ref([]);

// 字段显示名称映射
const fieldDisplayNames = {
    description: '角色描述',
    personality: '性格特征', 
    scenario: '背景场景',
    first_message: '首次问候',
    message_example: '示例对话',
    name: '条目名称',
    keywords: '关键词',
    content: '条目内容'
};

const getFieldDisplayName = (field) => {
    return fieldDisplayNames[field] || field;
};

const getChangeType = (original, translated) => {
    if (!original && !translated) return 'no-change';
    if (!original) return 'new-content';
    if (!translated) return 'removed';
    if (original === translated) return 'no-change';
    if (translated.length > original.length * 1.2) return 'expanded';
    if (translated.length < original.length * 0.8) return 'compressed';
    return 'modified';
};

const getChangeText = (original, translated) => {
    const type = getChangeType(original, translated);
    const changeMap = {
        'no-change': '无变化',
        'new-content': '新增内容',
        'removed': '删除内容',
        'expanded': '内容扩展',
        'compressed': '内容压缩',
        'modified': '内容修改'
    };
    return changeMap[type] || '已修改';
};

// 计算属性
const selectedCount = computed(() => {
    return compareItems.value.filter(item => item.selected && !item.failed).length;
});

const estimatedChanges = computed(() => {
    return compareItems.value.filter(item => 
        item.selected && getChangeType(item.original, item.translated) !== 'no-change'
    ).length;
});

// 方法
const updateSelection = () => {
    // 触发选择更新事件
};

const selectAll = () => {
    compareItems.value.forEach(item => {
        item.selected = !item.failed;
    });
};

const deselectAll = () => {
    compareItems.value.forEach(item => {
        item.selected = false;
    });
};

const previewChanges = () => {
    const selectedItems = compareItems.value.filter(item => item.selected);
    emit('preview', selectedItems);
};

const applySelected = () => {
    const selectedItems = compareItems.value.filter(item => item.selected);
    emit('apply', selectedItems);
};

const close = () => {
    emit('close');
};

// 监听props变化
watch(() => props.compareData, (newData) => {
    if (newData && newData.length > 0) {
        compareItems.value = newData.map(item => ({
            ...item,
            selected: item.failed ? false : (item.selected ?? true)
        }));
    }
}, { immediate: true });

watch(() => props.show, (newVal) => {
    if (newVal) {
        // 重置选择状态
        compareItems.value.forEach(item => {
            item.selected = item.failed ? false : (item.selected ?? true);
        });
    }
});
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 16px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
    width: 95%;
    max-width: 1200px;
    max-height: 95vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.compare-modal {
    background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 25px 30px;
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
}

.modal-header h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 22px;
    font-weight: 600;
}

.modal-icon {
    font-size: 28px;
}

.close-button {
    background: none;
    border: none;
    font-size: 32px;
    cursor: pointer;
    color: white;
    opacity: 0.8;
    transition: opacity 0.2s;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}

.close-button:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.2);
}

.modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 30px;
}

.compare-instructions {
    background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    border-left: 4px solid #2196f3;
}

.compare-instructions p {
    margin: 0;
    color: #37474f;
    font-size: 14px;
}

.translation-info {
    background: linear-gradient(135deg, #ffffff, #f8f9fa);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    border-left: 4px solid #28a745;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-label {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
}

.info-value {
    color: #28a745;
    font-weight: 500;
    font-size: 13px;
    background: rgba(40, 167, 69, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
}

.compare-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 25px;
    flex-wrap: wrap;
}

.action-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
    font-size: 13px;
}

.action-btn.primary {
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
}

.action-btn.secondary {
    background: #6c757d;
    color: white;
}

.action-btn.success {
    background: #28a745;
    color: white;
}

.action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.compare-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.compare-item {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 2px solid #e9ecef;
    transition: all 0.3s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.compare-item.item-selected {
    border-color: #667eea;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
}

.item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    flex-wrap: wrap;
    gap: 10px;
}

.selection-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-weight: 600;
}

.selection-checkbox input {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.field-name {
    font-size: 16px;
    color: #2c3e50;
}

.field-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    background: #e9ecef;
    color: #6c757d;
}

.field-badge.basic {
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
}

.field-badge.worldbook {
    background: linear-gradient(45deg, #f093fb, #f5576c);
    color: white;
}

.item-stats {
    display: flex;
    gap: 15px;
    align-items: center;
    font-size: 12px;
    flex-wrap: wrap;
}

.char-count {
    color: #6c757d;
}

.change-indicator {
    padding: 3px 8px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 11px;
}

.change-indicator.no-change {
    background: #e9ecef;
    color: #6c757d;
}

.change-indicator.modified {
    background: #fff3cd;
    color: #856404;
}

.change-indicator.expanded {
    background: #d1ecf1;
    color: #0c5460;
}

.change-indicator.compressed {
    background: #f8d7da;
    color: #721c24;
}

.change-indicator.new-content {
    background: #d4edda;
    color: #155724;
}

.content-compare {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 20px;
    align-items: start;
}

.content-column h4 {
    margin: 0 0 10px 0;
    color: #495057;
    font-size: 14px;
    font-weight: 600;
}

.content-box {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 12px;
    min-height: 80px;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 13px;
    line-height: 1.5;
    color: #495057;
}

.original .content-box {
    background: #fff5f5;
    border-color: #fecaca;
}

.translated .content-box {
    background: #f0fff4;
    border-color: #c6f6d5;
}

.content-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
}

.arrow-icon {
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
}

.summary-info {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
    border: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.selection-summary {
    font-weight: 600;
    color: #667eea;
}

.estimated-changes {
    color: #6c757d;
    font-size: 14px;
}

.modal-footer {
    padding: 20px 30px;
    border-top: 1px solid #e9ecef;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    background: #f8f9fa;
    flex-wrap: wrap;
}

.action-button {
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s;
    font-size: 14px;
}

.action-button.primary {
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
}

.action-button.secondary {
    background: #6c757d;
    color: white;
}

.action-button.preview {
    background: #17a2b8;
    color: white;
}

.action-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .content-compare {
        grid-template-columns: 1fr;
        gap: 15px;
    }
    
    .content-divider {
        padding: 10px 0;
    }
    
    .arrow-icon {
        transform: rotate(90deg);
    }
    
    .modal-content {
        width: 98%;
        max-height: 98vh;
    }
    
    .modal-body {
        padding: 20px;
    }
    
    .item-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .modal-footer {
        justify-content: center;
    }
}
</style> 