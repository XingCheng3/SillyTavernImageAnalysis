import { ref } from 'vue';
import { createEmptyCharacterBook } from '@/utils/editorCardAdapter';
import {
    buildWorldBookGeneratorSystemPrompt,
    buildWorldBookGeneratorUserPrompt,
} from '@/utils/worldBookAIGenerationPrompt';
import {
    mapDraftEntriesToEditableEntries,
    validateGenerationInput,
    validateWorldBookGenerationDraft,
} from '@/utils/worldBookAIGenerationValidator';

function getNextStartId(entries = []) {
    let maxId = -1;
    entries.forEach((entry) => {
        const parsed = Number.parseInt(entry?.id, 10);
        if (Number.isFinite(parsed)) {
            maxId = Math.max(maxId, parsed);
        }
    });
    return maxId + 1;
}

function getNextStartOrder(entries = []) {
    let maxOrder = -10;
    entries.forEach((entry) => {
        const candidate = Number.isFinite(entry?.insertion_order)
            ? entry.insertion_order
            : entry?.priority;

        if (Number.isFinite(candidate)) {
            maxOrder = Math.max(maxOrder, candidate);
        }
    });

    return maxOrder + 10;
}

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

function buildValidationSummary(result) {
    const warningText = result.warnings.map(item => `- ${item.path}: ${item.message}`).join('\n');
    return {
        warningText,
        warningCount: result.warnings.length,
        errorCount: result.errors.length,
    };
}

function normalizeOpeningBranches(openings = [], idMap = new Map()) {
    return (Array.isArray(openings) ? openings : []).map((opening, index) => {
        const enableEntryIds = (opening.enableEntryIds || []).map((id) => idMap.get(String(id)) || String(id));
        const disableEntryIds = (opening.disableEntryIds || []).map((id) => idMap.get(String(id)) || String(id));

        return {
            id: String(opening.id || `OP${index + 1}`),
            title: String(opening.title || `开场白 ${index + 1}`),
            text: String(opening.text || '').trim(),
            enableEntryIds,
            disableEntryIds,
        };
    });
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
        const validation = validateWorldBookGenerationDraft(draft, { requireContent: true });
        if (!validation.ok) {
            const message = validation.errors.map(item => `${item.path}: ${item.message}`).join('\n');
            throw new Error(message || '草稿结构不合法，无法应用。');
        }

        if (!editableData) {
            throw new Error('未检测到可编辑角色卡数据。');
        }

        if (!editableData.character_book) {
            editableData.character_book = createEmptyCharacterBook();
        }

        const replaceExisting = options.replaceExisting === true;
        const currentEntries = Array.isArray(editableData.book_entries) ? editableData.book_entries : [];
        const startIndex = replaceExisting ? 0 : currentEntries.length;
        const startId = replaceExisting ? 0 : getNextStartId(currentEntries);
        const startOrder = replaceExisting ? 0 : getNextStartOrder(currentEntries);

        const mappedEntries = mapDraftEntriesToEditableEntries(validation.normalized.entries, {
            startIndex,
            startId,
            startOrder,
        });

        editableData.character_book.name = validation.normalized.book.name || editableData.character_book.name || '世界书';
        editableData.character_book.description = validation.normalized.book.description || editableData.character_book.description || '';

        editableData.book_entries = replaceExisting
            ? mappedEntries
            : [...currentEntries, ...mappedEntries];

        const idMap = new Map();
        validation.normalized.entries.forEach((entry, index) => {
            idMap.set(String(entry.id), String(mappedEntries[index]?.id));
        });

        const openingBranches = normalizeOpeningBranches(validation.normalized.openings, idMap);

        if (!editableData.character_book.extensions || typeof editableData.character_book.extensions !== 'object') {
            editableData.character_book.extensions = {};
        }

        editableData.character_book.extensions.ai_opening_branches = openingBranches;
        editableData.character_book.extensions.ai_opening_updated_at = new Date().toISOString();
        editableData.character_book.extensions.ai_opening_schema = 'sillytavern.worldbook.ai.openings.v1';

        const applyOpeningsToGreetings = options.applyOpeningsToGreetings !== false;
        const openingTexts = openingBranches
            .map(item => item.text)
            .filter(Boolean);

        if (applyOpeningsToGreetings && openingTexts.length > 0) {
            editableData.first_message = openingTexts[0];
            editableData.alternate_greetings = openingTexts.slice(1);
        }

        const summary = buildValidationSummary(validation);

        return {
            replaced: replaceExisting,
            addedCount: mappedEntries.length,
            totalCount: editableData.book_entries.length,
            openingCount: openingBranches.length,
            greetingsSyncedCount: applyOpeningsToGreetings ? openingTexts.length : 0,
            warnings: validation.warnings,
            ...summary,
        };
    };

    return {
        isGenerating,
        lastDraft,
        validationWarnings,
        generateDraft,
        applyDraftToEditableData,
    };
}
