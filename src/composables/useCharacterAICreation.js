import { ref } from 'vue';
import { CharacterCardUtils } from '@/utils/characterCardParser';
import {
    buildCharacterAICreateSystemPrompt,
    buildCharacterAICreateUserPrompt,
} from '@/utils/characterAICreationPrompt';
import {
    validateCharacterCreateInput,
    validateCharacterDraft,
} from '@/utils/characterAICreationValidator';

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

function parseDraftResponse(content = '') {
    const jsonText = extractJsonText(content);
    if (!jsonText) {
        throw new Error('AI 未返回有效角色卡草稿 JSON。');
    }

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`角色卡草稿 JSON 解析失败：${error.message}`);
    }
}

function applyCardFieldsToTemplate(template, card = {}) {
    const data = template.data || {};

    data.name = card.name || data.name || '新角色';
    data.description = card.description || '';
    data.personality = card.personality || '';
    data.scenario = card.scenario || '';
    data.first_mes = card.first_message || '';
    data.alternate_greetings = Array.isArray(card.alternate_greetings)
        ? [...card.alternate_greetings]
        : [];
    data.creator_notes = card.creator_notes || '';
    data.system_prompt = card.system_prompt || '';
    data.post_history_instructions = card.post_history_instructions || '';
    data.mes_example = card.message_example || '';

    template.data = data;
    return template;
}

export function useCharacterAICreation({ apiSettings, openErrorModal, showOperationNotice }) {
    const isGenerating = ref(false);
    const draft = ref(null);
    const draftWarnings = ref([]);

    const generateDraft = async (input = {}) => {
        const inputValidation = validateCharacterCreateInput(input);
        if (!inputValidation.ok) {
            throw new Error(inputValidation.errors.map(item => item.message).join('\n'));
        }

        if (!apiSettings.value?.url || !apiSettings.value?.model) {
            throw new Error('请先配置 API URL 和模型后再创建角色卡。');
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
                    temperature: 0.8,
                    messages: [
                        { role: 'system', content: buildCharacterAICreateSystemPrompt() },
                        { role: 'user', content: buildCharacterAICreateUserPrompt(inputValidation.normalized) },
                    ],
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`创建请求失败（HTTP ${response.status}）：${text || response.statusText}`);
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || '';
            const rawDraft = parseDraftResponse(content);
            const validation = validateCharacterDraft(rawDraft);

            if (!validation.ok) {
                throw new Error(validation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
            }

            draft.value = validation.normalized;
            draftWarnings.value = validation.warnings;

            showOperationNotice?.({
                type: validation.warnings.length ? 'warning' : 'success',
                title: validation.warnings.length ? '角色卡草稿已生成（含提醒）' : '角色卡草稿生成成功',
                message: `角色名：${validation.normalized.card.name}，世界书条目：${validation.normalized.worldbookDraft.entries.length}。`,
                duration: 5000,
            });

            return {
                draft: validation.normalized,
                warnings: validation.warnings,
            };
        } catch (error) {
            openErrorModal?.({
                title: 'AI 创建角色卡失败',
                code: 'AI_CHARACTER_CREATE_FAILED',
                message: error.message,
                details: { message: error.message },
            });
            throw error;
        } finally {
            isGenerating.value = false;
        }
    };

    const buildCharacterTemplateFromDraft = (normalizedDraft) => {
        const validation = validateCharacterDraft(normalizedDraft || {});
        if (!validation.ok) {
            throw new Error(validation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
        }

        const template = CharacterCardUtils.createTemplate(validation.normalized.card.name || '新角色');
        applyCardFieldsToTemplate(template, validation.normalized.card);

        return {
            characterData: template,
            worldbookDraft: validation.normalized.worldbookDraft,
            warnings: validation.warnings,
        };
    };

    const clearDraft = () => {
        draft.value = null;
        draftWarnings.value = [];
    };

    return {
        isGenerating,
        draft,
        draftWarnings,
        generateDraft,
        buildCharacterTemplateFromDraft,
        clearDraft,
    };
}
