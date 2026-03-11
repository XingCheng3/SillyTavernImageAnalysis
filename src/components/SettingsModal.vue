<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content settings-modal">
            <div class="modal-header">
                <div>
                    <p class="modal-eyebrow">Workspace Setup</p>
                    <h2>设置</h2>
                </div>
                <button @click="close" class="close-button" aria-label="关闭">&times;</button>
            </div>

            <div class="modal-body">
                <div class="config-section card-shell">
                    <div class="section-heading">
                        <div>
                            <h3>API 配置</h3>
                            <p>配置模型接口、选择模型并验证连接状态。</p>
                        </div>
                        <div class="status-chip" :class="`is-${appStore.apiStatus}`">{{ appStore.apiStatus }}</div>
                    </div>

                    <div class="form-grid">
                        <div class="form-group full-span">
                            <label for="api-url">API URL</label>
                            <input id="api-url" type="text" v-model="apiUrl" placeholder="例如: https://api.openai.com/v1" />
                        </div>

                        <div class="form-group full-span">
                            <label for="api-key">API Key</label>
                            <input id="api-key" type="password" v-model="apiKey" placeholder="请输入您的 API Key" />
                        </div>

                        <div class="form-group">
                            <label for="model-name">模型名称</label>
                            <input id="model-name" type="text" v-model="apiModel" placeholder="例如: gpt-4o" />
                        </div>

                        <div class="form-group">
                            <label for="model-select">预设模型</label>
                            <div class="model-selection">
                                <select id="model-select" v-model="selectedPresetModel" @change="onModelSelect" :disabled="isLoadingModels || !models.length">
                                    <option value="">-- 请选择 --</option>
                                    <option v-if="isLoadingModels" value="">正在加载...</option>
                                    <option v-for="model in models" :key="model.id" :value="model.id">{{ model.id }}</option>
                                </select>
                                <button @click="fetchModels" :disabled="isLoadingModels" class="action-button secondary compact-btn">
                                    {{ isLoadingModels ? '加载中...' : '获取模型列表' }}
                                </button>
                            </div>
                            <p v-if="error" class="error-text">{{ error }}</p>
                        </div>
                    </div>

                    <div class="api-actions">
                        <button @click="testApiConnection" :disabled="isLoadingModels || isSaving" class="action-button secondary">
                            测试连接
                        </button>
                        <p v-if="testMessage" :class="['inline-feedback', { success: isTestSuccess }]">{{ testMessage }}</p>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <p v-if="saveMessage" :class="['inline-feedback', { success: isSaveSuccess }]">{{ saveMessage }}</p>
                <div class="footer-actions">
                    <button @click="close" :disabled="isSaving" class="action-button secondary ghost-btn">取消</button>
                    <button @click="saveSettings" class="action-button primary" :disabled="isSaving">
                        {{ isSaving ? '保存中...' : '保存设置' }}
                    </button>
                </div>
            </div>
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
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { useConfirmDialog } from '@/composables/useConfirmDialog';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';

const props = defineProps({
    show: Boolean
});

const emit = defineEmits(['close', 'save']);

const appStore = useAppStore();
const { apiSettings, translationConfig } = storeToRefs(appStore);

const apiUrl = computed({
    get: () => apiSettings.value.url,
    set: (value) => appStore.setApiSettings({ ...apiSettings.value, url: value })
});
const apiKey = computed({
    get: () => apiSettings.value.key,
    set: (value) => appStore.setApiSettings({ ...apiSettings.value, key: value })
});
const apiModel = computed({
    get: () => apiSettings.value.model,
    set: (value) => appStore.setApiSettings({ ...apiSettings.value, model: value })
});

const systemPrompt = computed({
    get: () => translationConfig.value.systemPrompt,
    set: (value) => {
        const newConfig = { ...translationConfig.value, systemPrompt: value };
        appStore.setTranslationConfig(newConfig);
    }
});

const jailbreakText = computed({
    get: () => translationConfig.value.jailbreakText,
    set: (value) => {
        const newConfig = { ...translationConfig.value, jailbreakText: value };
        appStore.setTranslationConfig(newConfig);
    }
});

const selectedPresetModel = ref('');
const models = ref([]);
const isLoadingModels = ref(false);
const isSaving = ref(false);
const error = ref('');
const testMessage = ref('');
const isTestSuccess = ref(false);
const saveMessage = ref('');
const isSaveSuccess = ref(false);
const { confirmDialog, closeConfirmDialog, confirmAction } = useConfirmDialog();

const close = () => {
    emit('close');
};

const onModelSelect = () => {
    if (selectedPresetModel.value) {
        apiModel.value = selectedPresetModel.value;
    }
};

const saveSettings = async () => {
    if (!apiUrl.value || !apiKey.value || !apiModel.value) {
        saveMessage.value = '请填写所有必填字段';
        isSaveSuccess.value = false;
        return;
    }

    isSaving.value = true;
    saveMessage.value = '正在保存设置...';
    isSaveSuccess.value = false;

    try {
        appStore.setApiSettings({
            url: apiUrl.value,
            key: apiKey.value,
            model: apiModel.value
        });

        emit('save', {
            apiUrl: apiUrl.value,
            apiKey: apiKey.value,
            selectedModel: apiModel.value,
            translationConfig: {
                systemPrompt: systemPrompt.value,
                jailbreakText: jailbreakText.value
            }
        });

        saveMessage.value = '设置已成功保存！';
        isSaveSuccess.value = true;

        setTimeout(() => {
            if (isSaveSuccess.value) {
                saveMessage.value = '';
            }
        }, 2000);
    } catch (err) {
        console.error('保存设置时出错:', err);
        saveMessage.value = `保存失败: ${err.message}`;
        isSaveSuccess.value = false;
    } finally {
        isSaving.value = false;
    }
};

const fetchModels = async () => {
    if (!apiUrl.value || !apiKey.value) {
        error.value = '请先输入 API URL 和 API Key。';
        return;
    }

    isLoadingModels.value = true;
    error.value = '';
    models.value = [];

    try {
        const response = await fetch(`${apiUrl.value}/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey.value}`
            }
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP错误! 状态: ${response.status}`);
        }

        const data = await response.json();
        models.value = data.data || [];
        if (!models.value.length) {
            error.value = '未找到可用的模型。';
        }
    } catch (err) {
        error.value = `获取模型失败: ${err.message}`;
        console.error(err);
    } finally {
        isLoadingModels.value = false;
    }
};

const testApiConnection = async () => {
    if (!apiUrl.value || !apiKey.value || !apiModel.value) {
        testMessage.value = '请先输入 API URL、API Key 和选择模型。';
        isTestSuccess.value = false;
        appStore.setApiStatus('untested');
        return;
    }

    testMessage.value = '正在测试连接...';
    isTestSuccess.value = false;
    appStore.setApiStatus('testing');

    try {
        const response = await fetch(`${apiUrl.value}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.value}`
            },
            body: JSON.stringify({
                model: apiModel.value,
                messages: [{ role: 'user', content: '你好' }],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP错误! 状态: ${response.status}`);
        }

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            testMessage.value = 'API连接成功！';
            isTestSuccess.value = true;
            appStore.setApiStatus('success');
        } else {
            throw new Error('API返回了无效的响应。');
        }
    } catch (err) {
        testMessage.value = `测试失败: ${err.message}`;
        isTestSuccess.value = false;
        appStore.setApiStatus('failed');
        console.error(err);
    }
};

onMounted(() => {
    appStore.loadApiSettings();
    appStore.loadTranslationConfig();
});

watch(() => props.show, (newVal) => {
    if (newVal) {
        appStore.loadApiSettings();
        appStore.loadTranslationConfig();
        selectedPresetModel.value = '';
        models.value = [];
        error.value = '';
        testMessage.value = '';
        saveMessage.value = '';
    }
});
</script>

<style scoped>
.settings-modal {
    width: min(100%, 920px);
}

.modal-header {
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
    color: #64748b;
}

.modal-header h2 {
    margin: 0;
}

.card-shell {
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    padding: 22px;
}

.section-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 20px;
}

.section-heading h3 {
    margin: 0 0 8px;
    color: #0f172a;
}

.section-heading p {
    margin: 0;
    color: #64748b;
    line-height: 1.6;
}

.status-chip {
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    text-transform: capitalize;
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
}

.status-chip.is-success {
    background: #dcfce7;
    border-color: #bbf7d0;
    color: #15803d;
}

.status-chip.is-failed {
    background: #fee2e2;
    border-color: #fecaca;
    color: #b91c1c;
}

.status-chip.is-testing {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1d4ed8;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group.full-span {
    grid-column: 1 / -1;
}

.form-group label {
    color: #334155;
    font-size: 13px;
    font-weight: 700;
}

.form-group input,
.form-group select {
    width: 100%;
    min-height: 48px;
    border-radius: 14px;
    border: 1px solid #dbe3ee;
    background: #fff;
    padding: 12px 14px;
    font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: #93c5fd;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.model-selection {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
}

.compact-btn {
    min-width: 136px;
}

.api-actions {
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.footer-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.inline-feedback {
    margin: 0;
    color: #dc2626;
    font-size: 14px;
}

.inline-feedback.success {
    color: #16a34a;
}

.error-text {
    margin: 0;
    color: #dc2626;
    font-size: 13px;
}

.ghost-btn {
    background: #fff;
    color: #334155;
}

@media (max-width: 900px) {
    .form-grid,
    .model-selection {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .modal-footer,
    .footer-actions,
    .api-actions {
        flex-direction: column;
        align-items: stretch;
    }

    .footer-actions > button,
    .api-actions > button {
        width: 100%;
    }
}
</style>
