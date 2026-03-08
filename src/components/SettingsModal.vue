<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content">
            <h2>设置</h2>
            
            <!-- API设置区域 -->
            <div class="config-section">
                <h3>API配置</h3>
                
                <div class="form-group">
                    <label for="api-url">API URL:</label>
                    <input id="api-url" type="text" v-model="apiUrl" placeholder="例如: https://api.openai.com/v1" />
                </div>

                <div class="form-group">
                    <label for="api-key">API Key:</label>
                    <input id="api-key" type="password" v-model="apiKey" placeholder="请输入您的API Key" />
                </div>

                <div class="form-group">
                    <label for="model-name">模型名称:</label>
                    <input id="model-name" type="text" v-model="apiModel" placeholder="例如: gpt-4o" />
                </div>

                <div class="form-group">
                    <label for="model-select">选择预设模型:</label>
                    <div class="model-selection">
                        <select id="model-select" v-model="selectedPresetModel" @change="onModelSelect" :disabled="isLoadingModels || !models.length">
                            <option value="">-- 请选择 --</option>
                            <option v-if="isLoadingModels" value="">正在加载...</option>
                            <option v-for="model in models" :key="model.id" :value="model.id">{{ model.id }}</option>
                        </select>
                        <button @click="fetchModels" :disabled="isLoadingModels">
                            {{ isLoadingModels ? '...' : '获取模型列表' }}
                        </button>
                    </div>
                    <p v-if="error" class="error-text">{{ error }}</p>
                </div>

                <div class="api-actions">
                    <button @click="testApiConnection" :disabled="isLoadingModels || isSaving">测试连接</button>
                    <p v-if="testMessage" :class="['test-result', { success: isTestSuccess }]">{{ testMessage }}</p>
                </div>
            </div>

            <!-- 翻译配置区域 -->
            <!-- <div class="config-section">
                <h3>翻译配置</h3>
                
                <div class="form-group">
                    <label for="system-prompt">翻译提示词:</label>
                    <textarea 
                        id="system-prompt" 
                        v-model="systemPrompt" 
                        placeholder="输入自定义翻译提示词..."
                        rows="4"
                    ></textarea>
                    <small class="field-description">
                        用于指导AI进行翻译的系统提示词，影响翻译风格和质量
                    </small>
                </div>

                <div class="form-group">
                    <label for="jailbreak-text">破限文本:</label>
                    <textarea 
                        id="jailbreak-text" 
                        v-model="jailbreakText" 
                        placeholder="输入破限文本..."
                        rows="3"
                    ></textarea>
                    <small class="field-description">
                        用于绕过可能的内容限制，确保翻译的完整性
                    </small>
                </div>

                <div class="translation-actions">
                    <button @click="resetTranslationConfig" class="secondary">重置为默认值</button>
                </div>
            </div> -->

            <div class="modal-actions">
                <button @click="saveSettings" class="primary" :disabled="isSaving">
                    {{ isSaving ? '保存中...' : '保存' }}
                </button>
                <button @click="close" :disabled="isSaving">取消</button>
            </div>
            <p v-if="saveMessage" :class="['save-result', { success: isSaveSuccess }]">{{ saveMessage }}</p>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';

const props = defineProps({
    show: Boolean
});

const emit = defineEmits(['close', 'save']);

const appStore = useAppStore();
const { apiSettings, translationConfig } = storeToRefs(appStore);

// 使用计算属性来代理 v-model
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

// 翻译配置的计算属性
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
        // 保存API设置到 store 和 Cookie
        appStore.setApiSettings({
            url: apiUrl.value,
            key: apiKey.value,
            model: apiModel.value
        });
        
        // 保存翻译配置到 localStorage（已通过计算属性自动保存）
        
        // 通知父组件设置已更新
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
        
        // 延迟2秒后清除消息
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

const resetTranslationConfig = () => {
    if (confirm('确定要将翻译配置重置为默认值吗？')) {
        appStore.resetTranslationConfig();
        saveMessage.value = '翻译配置已重置为默认值';
        isSaveSuccess.value = true;
        
        // 延迟2秒后清除消息
        setTimeout(() => {
            if (isSaveSuccess.value && saveMessage.value.includes('重置')) {
                saveMessage.value = '';
            }
        }, 2000);
    }
};

const fetchModels = async () => {
    if (!apiUrl.value || !apiKey.value) {
        error.value = '请先输入API URL和API Key。';
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
        testMessage.value = '请先输入API URL、API Key和选择模型。';
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
    // 加载保存的设置
    appStore.loadApiSettings();
    appStore.loadTranslationConfig();
});

watch(() => props.show, (newVal) => {
    if (newVal) {
        // 每次打开弹窗时，重新加载设置
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
    padding: 25px 30px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    width: 90%;
    max-width: 500px;
}

h2 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #333;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #555;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
}

.model-selection {
    display: flex;
    gap: 10px;
}

.model-selection select {
    flex-grow: 1;
}

.api-actions {
    margin-bottom: 20px;
}

.modal-actions {
    margin-top: 25px;
    text-align: right;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

button {
    padding: 10px 20px;
    border-radius: 4px;
    border: 1px solid #ccc;
    cursor: pointer;
    background-color: #f0f0f0;
    transition: background-color 0.2s;
}

button:hover {
    background-color: #e0e0e0;
}

button.primary {
    background-color: #4a89dc;
    color: white;
    border-color: #4a89dc;
}

button.primary:hover {
    background-color: #3b7dd8;
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.error-text {
    color: #e74c3c;
    margin-top: 8px;
    font-size: 14px;
}

.test-result,
.save-result {
    margin-top: 15px;
    text-align: right;
    font-size: 14px;
    color: #e74c3c; /* Error color */
}

.test-result.success,
.save-result.success {
    color: #2ecc71; /* Success color */
}

.config-section {
    margin-bottom: 20px;
}

.config-section h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #333;
}

.field-description {
    display: block;
    margin-top: 5px;
    font-size: 12px;
    color: #999;
}

.translation-actions {
    margin-top: 10px;
    text-align: right;
}

button.secondary {
    background-color: #f0f0f0;
    color: #333;
    border-color: #ccc;
}

button.secondary:hover {
    background-color: #e0e0e0;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .modal-content {
        width: 95%;
        max-width: 95%;
        padding: 20px;
    }

    .model-selection {
        flex-direction: column;
        align-items: stretch;
    }

    .modal-actions {
        flex-wrap: wrap;
        justify-content: center;
    }

    button {
        padding: 10px 14px;
    }
}
</style> 