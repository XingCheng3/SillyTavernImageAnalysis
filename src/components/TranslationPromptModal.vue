<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content prompt-modal">
            <div class="modal-header">
                <h2>
                    <span class="modal-icon">📝</span>
                    翻译提示词设置
                </h2>
                <button @click="close" class="close-button">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="form-group">
                    <label for="prompt-textarea">自定义翻译提示词：</label>
                    <textarea 
                        id="prompt-textarea" 
                        v-model="localPrompt" 
                        class="large-textarea"
                        placeholder="输入自定义翻译提示词，用于指导AI进行翻译..."
                        rows="12"
                    ></textarea>
                    <div class="textarea-info">
                        <small class="field-description">
                            这个提示词将作为系统消息发送给AI，影响翻译的风格和质量。留空则使用默认提示词。
                        </small>
                        <div class="char-count">{{ localPrompt.length }} 字符</div>
                    </div>
                </div>
                
                <div class="example-section">
                    <h4>💡 提示词示例：</h4>
                    <div class="example-items">
                        <div class="example-item" @click="useExample(examples.creative)">
                            <strong>创意翻译：</strong>适合角色卡、小说等创意内容
                        </div>
                        <div class="example-item" @click="useExample(examples.technical)">
                            <strong>技术翻译：</strong>适合说明文档、技术内容
                        </div>
                        <div class="example-item" @click="useExample(examples.casual)">
                            <strong>日常翻译：</strong>适合聊天、日常对话内容
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button @click="resetToDefault" class="action-button secondary">重置为默认</button>
                <button @click="save" class="action-button primary">保存</button>
                <button @click="close" class="action-button">取消</button>
            </div>
            <ConfirmDialog
                :show="confirmDialog.show"
                :title="confirmDialog.title"
                :message="confirmDialog.message"
                :description="confirmDialog.description"
                :confirm-text="confirmDialog.confirmText"
                :cancel-text="confirmDialog.cancelText"
                :variant="confirmDialog.variant"
                @confirm="confirmAction"
                @close="closeConfirmDialog"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { useConfirmDialog } from '@/composables/useConfirmDialog';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';

const props = defineProps({
    show: Boolean
});

const emit = defineEmits(['close']);

const appStore = useAppStore();
const { translationConfig } = storeToRefs(appStore);

const localPrompt = ref('');
const { confirmDialog, openConfirmDialog, closeConfirmDialog, confirmAction } = useConfirmDialog();

// 示例提示词
const examples = {
    creative: 'You are a professional translator specializing in creative content translation. Translate the following text to Simplified Chinese while maintaining the original tone, style, and emotional nuance. Pay special attention to character dialogue, narrative descriptions, and cultural references. Preserve the artistic and literary quality of the original text.',
    technical: 'You are a technical translator with expertise in converting technical documentation to Simplified Chinese. Ensure accuracy, clarity, and consistency in terminology. Maintain the professional tone and structure of the original content.',
    casual: 'You are a friendly translator. Translate the following text to natural, conversational Simplified Chinese. Keep the tone casual and approachable while ensuring the meaning is accurately conveyed.'
};

const close = () => {
    emit('close');
};

const save = () => {
    appStore.setTranslationConfig({
        systemPrompt: localPrompt.value,
        jailbreakText: translationConfig.value.jailbreakText
    });
    emit('close');
};

const resetToDefault = () => {
    openConfirmDialog({
        title: '重置翻译提示词',
        message: '确定要将当前翻译提示词重置为默认值吗？',
        description: '这会覆盖你当前尚未保存的编辑内容。',
        confirmText: '重置',
        variant: 'warning',
    }, () => {
        appStore.resetTranslationConfig();
        localPrompt.value = translationConfig.value.systemPrompt;
    });
};

const useExample = (exampleText) => {
    openConfirmDialog({
        title: '应用示例提示词',
        message: '确定要使用这个示例提示词吗？',
        description: '当前文本会被示例内容替换。',
        confirmText: '应用示例',
        variant: 'warning',
    }, () => {
        localPrompt.value = exampleText;
    });
};

// 监听show属性变化，打开时加载当前配置
watch(() => props.show, (newVal) => {
    if (newVal) {
        localPrompt.value = translationConfig.value.systemPrompt;
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
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
}

.prompt-modal {
    background: linear-gradient(135deg, #f8f9fa, #ffffff);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 25px 30px;
    border-bottom: 2px solid #e9ecef;
    background: linear-gradient(45deg, #4a89dc, #3b7dd8);
    color: white;
    border-radius: 12px 12px 0 0;
}

.modal-header h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 600;
}

.modal-icon {
    font-size: 24px;
}

.close-button {
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: white;
    opacity: 0.8;
    transition: opacity 0.2s;
    width: 32px;
    height: 32px;
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
    padding: 30px;
}

.form-group {
    margin-bottom: 25px;
}

.form-group label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    color: #2c3e50;
    font-size: 16px;
}

.large-textarea {
    width: 100%;
    min-height: 300px;
    padding: 16px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.6;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    background-color: #f8f9fa;
    transition: border-color 0.3s, box-shadow 0.3s;
    resize: vertical;
}

.large-textarea:focus {
    outline: none;
    border-color: #4a89dc;
    box-shadow: 0 0 0 3px rgba(74, 137, 220, 0.2);
    background-color: white;
}

.textarea-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 8px;
}

.field-description {
    color: #6c757d;
    font-size: 13px;
    line-height: 1.4;
    flex: 1;
}

.char-count {
    color: #6c757d;
    font-size: 12px;
    font-weight: 500;
    margin-left: 15px;
}

.example-section {
    background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #e1f5fe;
}

.example-section h4 {
    margin: 0 0 15px 0;
    color: #2c3e50;
    display: flex;
    align-items: center;
    gap: 8px;
}

.example-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.example-item {
    padding: 12px 16px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 14px;
}

.example-item:hover {
    border-color: #4a89dc;
    background: linear-gradient(45deg, #f8f9ff, #ffffff);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(74, 137, 220, 0.2);
}

.example-item strong {
    color: #4a89dc;
}

.modal-footer {
    padding: 20px 30px;
    border-top: 1px solid #e9ecef;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    background-color: #f8f9fa;
    border-radius: 0 0 12px 12px;
}

.action-button {
    padding: 10px 20px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
    font-size: 14px;
}

.action-button.primary {
    background: linear-gradient(45deg, #4a89dc, #3b7dd8);
    color: white;
}

.action-button.primary:hover {
    background: linear-gradient(45deg, #3b7dd8, #2a6bc7);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 137, 220, 0.3);
}

.action-button.secondary {
    background-color: #f39c12;
    color: white;
}

.action-button.secondary:hover {
    background-color: #e67e22;
    transform: translateY(-1px);
}

.action-button:not(.primary):not(.secondary) {
    background-color: #6c757d;
    color: white;
}

.action-button:not(.primary):not(.secondary):hover {
    background-color: #5a6268;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .modal-content {
        width: 95%;
        max-width: 95%;
    }

    .modal-header { padding: 18px 20px; }
    .modal-body { padding: 18px 20px; }
    .modal-footer { padding: 16px 20px; justify-content: center; flex-wrap: wrap; }

    .large-textarea {
        min-height: 220px;
        font-size: 13px;
    }

    .textarea-info { flex-direction: column; gap: 8px; }
}
</style> 