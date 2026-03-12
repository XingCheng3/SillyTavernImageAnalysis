import { ref } from 'vue';
import {
    buildWorldBookGeneratorSystemPrompt,
    buildWorldBookGeneratorUserPrompt,
} from '@/utils/worldBookAIGenerationPrompt';
import {
    validateGenerationInput,
    validateWorldBookGenerationDraft,
} from '@/utils/worldBookAIGenerationValidator';
import {
    applyWorldBookDraftToEditableData,
} from '@/utils/worldBookAIDraftApply';

function extractJsonText(raw = '') {
    const text = String(raw || '').trim();
    if (!text) return '';

    if (text.startsWith('{') || text.startsWith('[')) {
        return text;
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
        return fenced[1].trim();
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return text.slice(firstBrace, lastBrace + 1);
    }

    return text;
}

function parseDraftResponse(content) {
    const jsonText = extractJsonText(content);
    if (!jsonText) {
        throw new Error('AI 未返回有效 JSON 草稿内容。');
    }

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`AI 草稿 JSON 解析失败：${error.message}`);
    }
}

export function useWorldBookAIGeneration({ apiSettings, openErrorModal, showOperationNotice }) {
    const isGenerating = ref(false);
    const lastDraft = ref(null);
    const validationWarnings = ref([]);

    const generateDraft = async (input = {}) => {
        const inputValidation = validateGenerationInput(input);
        if (!inputValidation.ok) {
            const message = inputValidation.errors.map(item => item.message).join('\n');
            throw new Error(message || '生成参数不完整');
        }

        if (!apiSettings.value?.url || !apiSettings.value?.model) {
            throw new Error('请先配置 API URL 和模型后再生成。');
        }

        isGenerating.value = true;

        try {
            const response = await fetch(`${apiSettings.value.url}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.value.key}`,
                },
                body: JSON.stringify({
                    model: apiSettings.value.model,
                    temperature: 0.7,
                    messages: [
                        { role: 'system', content: buildWorldBookGeneratorSystemPrompt() },
                        { role: 'user', content: buildWorldBookGeneratorUserPrompt(inputValidation.normalized) },
                    ],
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`生成请求失败（HTTP ${response.status}）：${text || response.statusText}`);
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || '';
            const draft = parseDraftResponse(content);

            const validation = validateWorldBookGenerationDraft(draft, { requireContent: true });
            if (!validation.ok) {
                const message = validation.errors.map(item => `${item.path}: ${item.message}`).join('\n');
                throw new Error(message || 'AI 生成结果未通过结构校验');
            }

            validationWarnings.value = validation.warnings;
            lastDraft.value = validation.normalized;

            if (validation.warnings.length > 0) {
                showOperationNotice?.({
                    type: 'warning',
                    title: 'AI 草稿已生成（含校验提醒）',
                    message: `已生成 ${validation.normalized.entries.length} 条目，含 ${validation.warnings.length} 条提醒。建议先预览再应用。`,
                    duration: 5000,
                });
            } else {
                showOperationNotice?.({
                    type: 'success',
                    title: 'AI 草稿生成成功',
                    message: `已生成 ${validation.normalized.entries.length} 条世界书条目。`,
                    duration: 4000,
                });
            }

            return {
                draft: validation.normalized,
                warnings: validation.warnings,
            };
        } catch (error) {
            openErrorModal?.({
                title: '世界书 AI 生成失败',
                code: 'AI_WORLD_BOOK_GENERATION_FAILED',
                message: error.message,
                details: { message: error.message },
            });
            throw error;
        } finally {
            isGenerating.value = false;
        }
    };

    const applyDraftToEditableData = (editableData, draft, options = {}) => {
        return applyWorldBookDraftToEditableData(editableData, draft, options);
    };

    return {
        isGenerating,
        lastDraft,
        validationWarnings,
        generateDraft,
        applyDraftToEditableData,
    };
}
