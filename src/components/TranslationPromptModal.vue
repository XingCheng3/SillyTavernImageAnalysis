<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content prompt-modal">
            <div class="modal-header">
                <div>
                    <p class="modal-eyebrow">Prompt Studio</p>
                    <h2>
                        <span class="modal-icon">📝</span>
                        翻译提示词设置
                    </h2>
                </div>
                <button @click="close" class="close-button" aria-label="关闭">&times;</button>
            </div>

            <div class="modal-body">
                <div class="editor-shell">
                    <div class="form-group">
                        <label for="prompt-textarea">自定义翻译提示词</label>
                        <textarea 
                            id="prompt-textarea" 
                            v-model="localPrompt" 
                            class="large-textarea"
                            placeholder="输入自定义翻译提示词，用于指导 AI 进行翻译..."
                            rows="12"
                        ></textarea>
                        <div class="textarea-info">
                            <small class="field-description">
                                这个提示词将作为系统消息发送给 AI，影响翻译风格、语气和保留策略。留空则使用默认提示词。
                            </small>
                            <div class="char-count">{{ localPrompt.length }} 字符</div>
                        </div>
                    </div>
                </div>

                <div class="example-section">
                    <div class="section-head">
                        <h4>提示词示例</h4>
                        <p>点击任意卡片即可替换当前内容。</p>
                    </div>
                    <div class="example-items">
                        <div class="example-item" @click="useExample(examples.creative)">
                            <strong>创意翻译</strong>
                            <span>适合角色卡、小说、设定稿等创作型内容。</span>
                        </div>
                        <div class="example-item" @click="useExample(examples.technical)">
                            <strong>技术翻译</strong>
                            <span>适合说明文档、规则描述、技术资料。</span>
                        </div>
                        <div class="example-item" @click="useExample(examples.casual)">
                            <strong>日常翻译</strong>
                            <span>适合聊天、口语化对话和轻量文本。</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button @click="resetToDefault" class="action-button secondary">重置为默认</button>
                <div class="footer-actions">
                    <button @click="close" class="action-button ghost-btn">取消</button>
                    <button @click="save" class="action-button primary">保存</button>
                </div>
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
import { ref, watch } from 'vue';
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

watch(() => props.show, (newVal) => {
    if (newVal) {
        localPrompt.value = translationConfig.value.systemPrompt;
    }
});
</script>

<style scoped>
.prompt-modal {
    width: min(100%, 1040px);
}

.modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
}

.modal-eyebrow {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
}

.modal-header h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
}

.modal-icon {
    font-size: 24px;
}

.editor-shell,
.example-section {
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    padding: 20px;
}

.example-section {
    margin-top: 18px;
    background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.form-group label,
.section-head h4 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
}

.large-textarea {
    width: 100%;
    min-height: 420px;
    border-radius: 18px;
    border: 1px solid #dbe3ee;
    background: #fff;
    padding: 18px;
    font-size: 14px;
    line-height: 1.75;
    font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace;
    resize: vertical;
}

.large-textarea:focus {
    outline: none;
    border-color: #93c5fd;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.textarea-info {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
}

.field-description,
.section-head p {
    margin: 0;
    color: #64748b;
    line-height: 1.7;
    font-size: 14px;
}

.char-count {
    flex-shrink: 0;
    padding: 6px 10px;
    border-radius: 999px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #2563eb;
    font-size: 12px;
    font-weight: 800;
}

.section-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 16px;
}

.example-items {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.example-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 128px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255,255,255,0.9);
    border: 1px solid #dbe3ee;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.example-item:hover {
    transform: translateY(-2px);
    border-color: #93c5fd;
    box-shadow: 0 16px 28px rgba(37, 99, 235, 0.10);
}

.example-item strong {
    color: #1d4ed8;
}

.example-item span {
    color: #475569;
    line-height: 1.6;
    font-size: 14px;
}

.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.footer-actions {
    display: flex;
    gap: 12px;
}

.ghost-btn {
    background: #fff;
    color: #334155;
}

@media (max-width: 960px) {
    .example-items {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .textarea-info,
    .modal-footer,
    .footer-actions,
    .section-head {
        flex-direction: column;
        align-items: stretch;
    }

    .footer-actions > button,
    .modal-footer > button {
        width: 100%;
    }

    .large-textarea {
        min-height: 320px;
    }
}
</style>
