// 流式翻译相关的 Composable
import { ref } from 'vue';

/**
 * 流式翻译处理器
 * 支持分批翻译和实时结果流式输出
 */
export function useStreamTranslation() {
    const isStreaming = ref(false);
    const currentBatch = ref(0);
    const totalBatches = ref(0);
    const currentBatchProgress = ref(0);
    const streamResults = ref([]);
    const abortController = ref(null);

    /**
     * 解析流式返回的XML标签内容
     * @param {string} text - 当前累积的文本
     * @param {object} tagMap - 标签映射表
     * @returns {object} - 已解析的结果
     */
    const parseStreamResults = (text, tagMap) => {
        const results = {};
        
        for (const [tag, info] of Object.entries(tagMap)) {
            // 尝试匹配完整的标签对
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = text.match(regex);
            
            if (match && match[1]) {
                results[tag] = {
                    content: match[1].trim(),
                    info: info,
                    completed: true
                };
            } else {
                // 检查是否有未完成的开始标签
                const openRegex = new RegExp(`<${tag}>([\\s\\S]*)$`, 'i');
                const openMatch = text.match(openRegex);
                
                if (openMatch && openMatch[1]) {
                    results[tag] = {
                        content: openMatch[1].trim(),
                        info: info,
                        completed: false
                    };
                }
            }
        }
        
        return results;
    };

    /**
     * 流式翻译请求
     * @param {object} params - 参数
     * @param {string} params.apiUrl - API地址
     * @param {string} params.apiKey - API密钥
     * @param {string} params.model - 模型名称
     * @param {string} params.systemPrompt - 系统提示词
     * @param {string} params.userContent - 用户内容（带标签）
     * @param {object} params.tagMap - 标签映射表
     * @param {function} params.onProgress - 进度回调
     * @returns {Promise<object>} - 翻译结果
     */
    const streamTranslate = async ({
        apiUrl,
        apiKey,
        model,
        systemPrompt,
        userContent,
        tagMap,
        onProgress
    }) => {
        isStreaming.value = true;
        abortController.value = new AbortController();
        
        let accumulatedText = '';
        let lastResults = {};
        
        try {
            const requestBody = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                stream: true,
                temperature: 0.3
            };
            
            console.log('🔥 流式翻译请求体:', requestBody);
            console.log('🔥 stream 参数值:', requestBody.stream);
            
            const response = await fetch(apiUrl + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: abortController.value.signal
            });
            
            console.log('🔥 请求已发送，等待响应...');

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
                    console.log('流式翻译完成');
                    break;
                }

                // 解码数据块
                buffer += decoder.decode(value, { stream: true });
                
                // 按行分割处理 SSE 数据
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    
                    if (!trimmed || trimmed === 'data: [DONE]') {
                        continue;
                    }

                    if (trimmed.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmed.substring(6);
                            const data = JSON.parse(jsonStr);
                            
                            const delta = data.choices?.[0]?.delta?.content;
                            if (delta) {
                                accumulatedText += delta;
                                
                                // 实时解析结果
                                const currentResults = parseStreamResults(accumulatedText, tagMap);
                                
                                // 检查是否有新完成的条目
                                for (const [tag, result] of Object.entries(currentResults)) {
                                    if (result.completed && (!lastResults[tag] || !lastResults[tag].completed)) {
                                        // 有新条目完成
                                        currentBatchProgress.value++;
                                        
                                        if (onProgress) {
                                            onProgress({
                                                tag,
                                                result: result.content,
                                                info: result.info,
                                                completed: true
                                            });
                                        }
                                    } else if (!result.completed && onProgress) {
                                        // 更新进行中的条目
                                        onProgress({
                                            tag,
                                            result: result.content,
                                            info: result.info,
                                            completed: false
                                        });
                                    }
                                }
                                
                                lastResults = currentResults;
                            }
                        } catch (e) {
                            console.warn('解析 SSE 数据失败:', trimmed, e);
                        }
                    }
                }
            }

            // 最终解析完整结果
            const finalResults = parseStreamResults(accumulatedText, tagMap);
            const translationResults = {};
            
            for (const [tag, result] of Object.entries(finalResults)) {
                if (result.completed) {
                    translationResults[tag] = result.content;
                }
            }

            return {
                success: true,
                results: translationResults,
                fullText: accumulatedText
            };

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('流式翻译被取消');
                return {
                    success: false,
                    cancelled: true,
                    error: '翻译已取消'
                };
            }
            
            console.error('流式翻译失败:', error);
            return {
                success: false,
                error: error.message || '翻译失败'
            };
        } finally {
            isStreaming.value = false;
        }
    };

    /**
     * 取消流式翻译
     */
    const cancelStream = () => {
        if (abortController.value) {
            abortController.value.abort();
        }
    };

    /**
     * 重置状态
     */
    const reset = () => {
        isStreaming.value = false;
        currentBatch.value = 0;
        totalBatches.value = 0;
        currentBatchProgress.value = 0;
        streamResults.value = [];
        abortController.value = null;
    };

    return {
        isStreaming,
        currentBatch,
        totalBatches,
        currentBatchProgress,
        streamResults,
        streamTranslate,
        cancelStream,
        reset
    };
}

