<template>
    <div class="stream-test-container">
        <div class="header-section">
            <div class="header-left">
                <router-link to="/" class="back-button" title="返回主页">
                    <span class="button-icon">←</span>
                    <span class="button-text">返回</span>
                </router-link>
                <h1>流式传输测试</h1>
            </div>
            <button @click="showSettingsModal = true" class="settings-button">API 设置</button>
        </div>

        <div class="api-status" :class="{ ready: isApiReady }">
            <span class="status-dot"></span>
            <span>API 状态: {{ isApiReady ? '已配置' : '未配置' }}</span>
            <span v-if="isApiReady" class="api-info">{{ apiSettings.model }}</span>
        </div>

        <div class="input-section">
            <div class="input-group">
                <label>测试消息：</label>
                <textarea 
                    v-model="userInput" 
                    placeholder="输入要发送的测试消息..."
                    class="input-textarea"
                    :disabled="isStreaming"
                    @keydown.ctrl.enter="sendMessage"
                ></textarea>
            </div>

            <div class="controls">
                <button 
                    @click="sendMessage" 
                    class="send-button" 
                    :disabled="!userInput.trim() || isStreaming || !isApiReady"
                >
                    {{ isStreaming ? '传输中...' : '发送 (Ctrl+Enter)' }}
                </button>
                <button 
                    v-if="isStreaming" 
                    @click="stopStreaming" 
                    class="stop-button"
                >
                    停止
                </button>
                <button 
                    @click="clearResult" 
                    class="clear-button"
                    :disabled="isStreaming"
                >
                    清空结果
                </button>
            </div>
        </div>

        <div class="result-section">
            <div class="result-header">
                <h3>流式输出结果</h3>
                <div class="result-stats">
                    <span v-if="streamStats.startTime">开始时间: {{ streamStats.startTime }}</span>
                    <span v-if="streamStats.duration">用时: {{ streamStats.duration }}</span>
                    <span v-if="streamStats.tokens">Token: {{ streamStats.tokens }}</span>
                </div>
            </div>

            <div class="result-box" ref="resultBox">
                <div v-if="!streamResult && !error" class="empty-state">
                    等待发送消息...
                </div>
                <div v-if="error" class="error-message">
                    <strong>错误：</strong>{{ error }}
                </div>
                <div v-if="streamResult" class="stream-content">
                    {{ streamResult }}<span v-if="isStreaming" class="cursor-blink">▋</span>
                </div>
            </div>
        </div>

        <SettingsModal 
            :show="showSettingsModal" 
            @close="showSettingsModal = false" 
        />
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';
import SettingsModal from '@/components/SettingsModal.vue';

const appStore = useAppStore();
const { apiSettings } = storeToRefs(appStore);

const userInput = ref('');
const streamResult = ref('');
const isStreaming = ref(false);
const error = ref('');
const showSettingsModal = ref(false);
const resultBox = ref(null);
const abortController = ref(null);

const streamStats = ref({
    startTime: '',
    duration: '',
    tokens: 0,
    startTimestamp: null
});

const isApiReady = computed(() => {
    return !!(apiSettings.value.url && apiSettings.value.model);
});

// 自动滚动到底部
const scrollToBottom = () => {
    if (resultBox.value) {
        resultBox.value.scrollTop = resultBox.value.scrollHeight;
    }
};

watch(streamResult, () => {
    scrollToBottom();
});

const sendMessage = async () => {
    if (!userInput.value.trim() || isStreaming.value || !isApiReady.value) {
        return;
    }

    // 检查 API 配置
    if (!apiSettings.value.url || !apiSettings.value.model) {
        error.value = '请先在设置中配置 API 信息';
        return;
    }

    // 重置状态
    streamResult.value = '';
    error.value = '';
    isStreaming.value = true;
    abortController.value = new AbortController();

    // 记录开始时间
    const startTime = new Date();
    streamStats.value.startTimestamp = startTime;
    streamStats.value.startTime = startTime.toLocaleTimeString('zh-CN');
    streamStats.value.duration = '';
    streamStats.value.tokens = 0;

    // 计时器
    const timer = setInterval(() => {
        if (streamStats.value.startTimestamp) {
            const duration = Math.floor((new Date() - streamStats.value.startTimestamp) / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            streamStats.value.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);

    try {
        const response = await fetch(apiSettings.value.url + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.value.key}`
            },
            body: JSON.stringify({
                model: apiSettings.value.model,
                messages: [
                    { role: 'user', content: userInput.value }
                ],
                stream: true,  // 启用流式传输
                temperature: 0.7
            }),
            signal: abortController.value.signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        // 读取流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('流式传输完成');
                break;
            }

            // 解码数据块
            buffer += decoder.decode(value, { stream: true });
            
            // 按行分割处理 SSE 数据
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留不完整的行

            for (const line of lines) {
                const trimmed = line.trim();
                
                if (!trimmed || trimmed === 'data: [DONE]') {
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmed.substring(6); // 移除 "data: " 前缀
                        const data = JSON.parse(jsonStr);
                        
                        // 提取流式内容
                        const delta = data.choices?.[0]?.delta?.content;
                        if (delta) {
                            streamResult.value += delta;
                            streamStats.value.tokens++;
                        }
                    } catch (e) {
                        console.warn('解析 SSE 数据失败:', trimmed, e);
                    }
                }
            }
        }

    } catch (err) {
        if (err.name === 'AbortError') {
            error.value = '已停止传输';
        } else {
            console.error('流式传输失败:', err);
            error.value = err.message || '流式传输失败';
        }
    } finally {
        isStreaming.value = false;
        clearInterval(timer);
    }
};

const stopStreaming = () => {
    if (abortController.value) {
        abortController.value.abort();
    }
};

const clearResult = () => {
    streamResult.value = '';
    error.value = '';
    streamStats.value = {
        startTime: '',
        duration: '',
        tokens: 0,
        startTimestamp: null
    };
};

// 页面加载时加载 API 设置
appStore.loadApiSettings();
</script>

<style scoped>
.stream-test-container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
}

.header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    margin-bottom: 25px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 13px;
    font-weight: 500;
    backdrop-filter: blur(10px);
    text-decoration: none;
}

.back-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.header-section h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
}

.settings-button {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 14px;
    font-weight: 500;
    backdrop-filter: blur(10px);
}

.settings-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.api-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 2px solid #e9ecef;
    font-weight: 500;
}

.api-status.ready {
    background: #d4edda;
    border-color: #c3e6cb;
    color: #155724;
}

.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #dc3545;
}

.api-status.ready .status-dot {
    background: #28a745;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.api-info {
    margin-left: auto;
    font-size: 13px;
    color: #6c757d;
    background: rgba(255, 255, 255, 0.7);
    padding: 4px 10px;
    border-radius: 12px;
}

.input-section {
    background: white;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    margin-bottom: 25px;
}

.input-group {
    margin-bottom: 20px;
}

.input-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 10px;
    color: #2c3e50;
    font-size: 16px;
}

.input-textarea {
    width: 100%;
    min-height: 120px;
    padding: 12px 16px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 15px;
    line-height: 1.6;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #fafbfc;
    color: #2c3e50;
    transition: all 0.3s ease;
    resize: vertical;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.input-textarea:focus {
    outline: none;
    border-color: #4a89dc;
    background-color: #ffffff;
    box-shadow: 0 0 0 3px rgba(74, 137, 220, 0.1), 0 4px 8px rgba(0, 0, 0, 0.1);
}

.input-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.controls {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.send-button {
    padding: 12px 30px;
    background: linear-gradient(45deg, #4a89dc, #3b7dd8);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 15px;
    transition: all 0.3s;
    box-shadow: 0 2px 8px rgba(74, 137, 220, 0.3);
}

.send-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(74, 137, 220, 0.4);
}

.send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.stop-button {
    padding: 12px 24px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s;
}

.stop-button:hover {
    background: #d62c1a;
    transform: translateY(-2px);
}

.clear-button {
    padding: 12px 24px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s;
}

.clear-button:hover:not(:disabled) {
    background: #5a6268;
}

.clear-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.result-section {
    background: white;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e9ecef;
}

.result-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 18px;
}

.result-stats {
    display: flex;
    gap: 20px;
    font-size: 13px;
    color: #6c757d;
    font-family: 'Courier New', monospace;
}

.result-box {
    min-height: 200px;
    max-height: 500px;
    overflow-y: auto;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
    position: relative;
}

.empty-state {
    text-align: center;
    color: #adb5bd;
    font-style: italic;
    padding: 60px 20px;
}

.error-message {
    color: #e74c3c;
    background: #fff5f5;
    border: 1px solid #ffd3d3;
    padding: 15px;
    border-radius: 6px;
}

.stream-content {
    white-space: pre-wrap;
    word-wrap: break-word;
    line-height: 1.8;
    font-size: 15px;
    color: #2c3e50;
}

.cursor-blink {
    animation: blink 1s infinite;
    color: #4a89dc;
    font-weight: bold;
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
}

/* 响应式设计 */
@media (max-width: 768px) {
    .stream-test-container {
        padding: 12px;
    }

    .header-section {
        flex-direction: column;
        gap: 12px;
        padding: 16px;
    }

    .result-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }

    .result-stats {
        flex-direction: column;
        gap: 5px;
    }

    .controls {
        flex-direction: column;
    }

    .send-button,
    .stop-button,
    .clear-button {
        width: 100%;
    }
}
</style>


