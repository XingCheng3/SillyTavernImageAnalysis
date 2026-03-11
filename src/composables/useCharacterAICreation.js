import { ref } from 'vue';
import { CharacterCardUtils } from '@/utils/characterCardParser';
import {
    buildCharacterAICreateExpandUserPrompt,
    buildCharacterAICreateStructureUserPrompt,
    buildCharacterAICreateSystemPrompt,
    buildCharacterAICreateUserPrompt,
} from '@/utils/characterAICreationPrompt';
import {
    CHARACTER_CREATE_GENERATION_MODES,
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

async function requestDraftFromModel({ apiSettings, userPrompt, temperature = 0.8 }) {
    const response = await fetch(`${apiSettings.url}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiSettings.key}`,
        },
        body: JSON.stringify({
            model: apiSettings.model,
            temperature,
            messages: [
                { role: 'system', content: buildCharacterAICreateSystemPrompt() },
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`创建请求失败（HTTP ${response.status}）：${text || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return parseDraftResponse(content);
}

export function useCharacterAICreation({ apiSettings, openErrorModal, showOperationNotice }) {
    const isGenerating = ref(false);
    const generationStageLabel = ref('');
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
        generationStageLabel.value = '准备中';

        try {
            let validation;

            if (inputValidation.normalized.generationMode === CHARACTER_CREATE_GENERATION_MODES.TWO_STEP) {
                generationStageLabel.value = '阶段1：生成结构骨架';
                const structureRawDraft = await requestDraftFromModel({
                    apiSettings: apiSettings.value,
                    userPrompt: buildCharacterAICreateStructureUserPrompt(inputValidation.normalized),
                    temperature: 0.75,
                });

                const structureValidation = validateCharacterDraft(structureRawDraft, {
                    requireWorldbookContent: false,
                });

                if (!structureValidation.ok) {
                    throw new Error(structureValidation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
                }

                generationStageLabel.value = '阶段2：扩写细化内容';
                const expandedRawDraft = await requestDraftFromModel({
                    apiSettings: apiSettings.value,
                    userPrompt: buildCharacterAICreateExpandUserPrompt(inputValidation.normalized, structureValidation.normalized),
                    temperature: 0.8,
                });

                validation = validateCharacterDraft(expandedRawDraft, {
                    requireWorldbookContent: true,
                });
            } else {
                generationStageLabel.value = '单阶段生成';
                const rawDraft = await requestDraftFromModel({
                    apiSettings: apiSettings.value,
                    userPrompt: buildCharacterAICreateUserPrompt(inputValidation.normalized),
                    temperature: 0.8,
                });

                validation = validateCharacterDraft(rawDraft, {
                    requireWorldbookContent: true,
                });
            }

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
            generationStageLabel.value = '';
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
        generationStageLabel.value = '';
    };

    return {
        isGenerating,
        generationStageLabel,
        draft,
        draftWarnings,
        generateDraft,
        buildCharacterTemplateFromDraft,
        clearDraft,
    };
}
