import { ref } from 'vue';
import { normalizeKeywords } from '@/utils/worldBookAIAuthoringSpec';
import {
    WORLD_BOOK_PATCH_ACTION,
    WORLD_BOOK_PATCH_MODE,
    WORLD_BOOK_PATCH_SCOPE,
    applyPatchOperationsToEntry,
    buildPatchPlanPreview,
    createPatchInstruction,
    findWorldBookEntryIndex,
    getEntryFieldText,
    getEntryParagraphs,
    getPatchTargetText,
    validatePatchInstruction,
    validatePatchPlan,
} from '@/utils/worldBookAIPatchSchema';
import {
    buildWorldBookPatchSystemPrompt,
    buildWorldBookPatchUserPrompt,
} from '@/utils/worldBookAIPatchPrompt';
import { buildLineDiff, summarizeLineDiff } from '@/utils/textDiffPreview';

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

function buildLegacyPlanFromReplacement(parsed = {}, validation, targetEntry) {
    const replacement = String(parsed?.replacement ?? '').trim();
    if (!replacement) {
        throw new Error('AI 返回的 replacement 为空。');
    }

    const patch = createPatchInstruction({
        ...validation.normalized,
        replacement,
    });

    const targetText = getPatchTargetText(targetEntry, patch);
    const base = {
        opId: 'legacy-op-1',
        entryId: String(targetEntry?.id ?? ''),
        field: patch.field || 'content',
        replacement,
        reason: 'legacy replacement fallback',
    };

    if (patch.field !== 'content') {
        return {
            summary: 'legacy replacement fallback',
            selectedEntryIds: [String(targetEntry?.id ?? '')],
            operations: [
                {
                    ...base,
                    action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE,
                },
            ],
        };
    }

    if (patch.scope === WORLD_BOOK_PATCH_SCOPE.PARAGRAPH) {
        if (patch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
            return {
                summary: 'legacy replacement fallback',
                selectedEntryIds: [String(targetEntry?.id ?? '')],
                operations: [
                    {
                        ...base,
                        action: WORLD_BOOK_PATCH_ACTION.APPEND_AFTER_TEXT,
                        searchText: targetText,
                        replacement: targetText ? `\n${replacement}` : replacement,
                        paragraphIndex: patch.paragraphIndex,
                    },
                ],
            };
        }

        if (patch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
            return {
                summary: 'legacy replacement fallback',
                selectedEntryIds: [String(targetEntry?.id ?? '')],
                operations: [
                    {
                        ...base,
                        action: WORLD_BOOK_PATCH_ACTION.PREPEND_BEFORE_TEXT,
                        searchText: targetText,
                        replacement: targetText ? `${replacement}\n` : replacement,
                        paragraphIndex: patch.paragraphIndex,
                    },
                ],
            };
        }

        return {
            summary: 'legacy replacement fallback',
            selectedEntryIds: [String(targetEntry?.id ?? '')],
            operations: [
                {
                    ...base,
                    action: WORLD_BOOK_PATCH_ACTION.REPLACE_PARAGRAPH,
                    paragraphIndex: patch.paragraphIndex,
                },
            ],
        };
    }

    if (patch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
        return {
            summary: 'legacy replacement fallback',
            selectedEntryIds: [String(targetEntry?.id ?? '')],
            operations: [
                targetText
                    ? {
                        ...base,
                        action: WORLD_BOOK_PATCH_ACTION.APPEND_AFTER_TEXT,
                        searchText: targetText,
                        replacement: `\n\n${replacement}`,
                    }
                    : {
                        ...base,
                        action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE,
                    },
            ],
        };
    }

    if (patch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
        return {
            summary: 'legacy replacement fallback',
            selectedEntryIds: [String(targetEntry?.id ?? '')],
            operations: [
                targetText
                    ? {
                        ...base,
                        action: WORLD_BOOK_PATCH_ACTION.PREPEND_BEFORE_TEXT,
                        searchText: targetText,
                        replacement: `${replacement}\n\n`,
                    }
                    : {
                        ...base,
                        action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE,
                    },
            ],
        };
    }

    return {
        summary: 'legacy replacement fallback',
        selectedEntryIds: [String(targetEntry?.id ?? '')],
        operations: [
            {
                ...base,
                action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE,
            },
        ],
    };
}

function parsePatchResponse(content = '', { validation, targetEntry } = {}) {
    const jsonText = extractJsonText(content);
    if (!jsonText) {
        throw new Error('AI 未返回有效改写结果。');
    }

    try {
        const parsed = JSON.parse(jsonText);
        if (parsed && typeof parsed === 'object' && typeof parsed.replacement === 'string') {
            return buildLegacyPlanFromReplacement(parsed, validation, targetEntry);
        }
        return parsed;
    } catch (error) {
        throw new Error(`AI 改写结果解析失败：${error.message}`);
    }
}

function ensureParagraphIndexInRange(entry, patch) {
    if (patch.scope !== 'paragraph') return;
    const paragraphs = getEntryParagraphs(entry);
    if (!paragraphs.length) {
        throw new Error('目标条目没有可改写段落内容。');
    }

    if (!Number.isFinite(patch.paragraphIndex) || patch.paragraphIndex < 0 || patch.paragraphIndex >= paragraphs.length) {
        throw new Error(`段落索引超出范围，当前条目共有 ${paragraphs.length} 段。`);
    }
}

export function useWorldBookAIPatch({ apiSettings, openErrorModal, showOperationNotice }) {
    const isPatching = ref(false);
    const patchPreview = ref(null);

    const clearPatchPreview = () => {
        patchPreview.value = null;
    };

    const generatePatchPreview = async ({ editableData, patchForm }) => {
        const validation = validatePatchInstruction(patchForm || {});
        if (!validation.ok) {
            throw new Error(validation.errors.map(item => item.message).join('\n'));
        }

        if (!apiSettings.value?.url || !apiSettings.value?.model) {
            throw new Error('请先配置 API URL 和模型后再改写。');
        }

        const entries = Array.isArray(editableData?.book_entries) ? editableData.book_entries : [];
        const targetIndex = findWorldBookEntryIndex(entries, validation.normalized.entryId);
        if (targetIndex < 0) {
            throw new Error(`未找到条目 id=${validation.normalized.entryId}`);
        }

        const targetEntry = entries[targetIndex];
        ensureParagraphIndexInRange(targetEntry, validation.normalized);

        isPatching.value = true;

        try {
            const response = await fetch(`${apiSettings.value.url}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.value.key}`,
                },
                body: JSON.stringify({
                    model: apiSettings.value.model,
                    temperature: 0.4,
                    messages: [
                        { role: 'system', content: buildWorldBookPatchSystemPrompt() },
                        {
                            role: 'user',
                            content: buildWorldBookPatchUserPrompt({
                                entries,
                                focusEntry: targetEntry,
                                patch: validation.normalized,
                            }),
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`改写请求失败（HTTP ${response.status}）：${text || response.statusText}`);
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || '';
            const parsedPlan = parsePatchResponse(content, {
                validation,
                targetEntry,
            });

            const planValidation = validatePatchPlan(parsedPlan, {
                entries,
                focusEntryId: validation.normalized.entryId,
                allowRelatedEntries: validation.normalized.allowRelatedEntries,
            });
            if (!planValidation.ok) {
                throw new Error(planValidation.errors.map(item => item.message).join('\n'));
            }

            const preview = buildPatchPlanPreview(entries, planValidation.normalized.operations);
            const entryPreviews = preview.entryPreviews.map((item) => {
                const lineDiff = buildLineDiff(item.beforeText, item.afterText);
                return {
                    ...item,
                    lineDiff,
                    diffSummary: summarizeLineDiff(lineDiff),
                };
            });

            patchPreview.value = {
                summary: planValidation.normalized.summary,
                selectedEntryIds: planValidation.normalized.selectedEntryIds,
                operationCount: preview.operationCount,
                affectedEntryIds: preview.affectedEntryIds,
                affectedEntryCount: preview.affectedEntryCount,
                entryPreviews,
                plan: planValidation.normalized,
                changed: entryPreviews.some(item => item.changed),
            };

            if (!patchPreview.value.changed) {
                showOperationNotice?.({
                    type: 'warning',
                    title: '改写预览生成成功（但内容未变化）',
                    message: '建议调整改写指令后重试。',
                    duration: 4500,
                });
            } else {
                showOperationNotice?.({
                    type: 'success',
                    title: '改写预览已生成',
                    message: `涉及 ${patchPreview.value.affectedEntryCount} 个条目，${patchPreview.value.operationCount} 个 patch 操作。`,
                    duration: 3500,
                });
            }

            return patchPreview.value;
        } catch (error) {
            openErrorModal?.({
                title: '世界书局部改写失败',
                code: 'AI_WORLD_BOOK_PATCH_FAILED',
                message: error.message,
                details: { message: error.message },
            });
            throw error;
        } finally {
            isPatching.value = false;
        }
    };

    const applyPatchPreviewToEditableData = (editableData, preview) => {
        if (!preview?.entryPreviews?.length) {
            throw new Error('没有可应用的改写预览。');
        }

        const entries = Array.isArray(editableData?.book_entries) ? editableData.book_entries : [];
        const appliedEntries = [];
        let changedCount = 0;

        preview.entryPreviews.forEach((entryPreview) => {
            const targetIndex = findWorldBookEntryIndex(entries, entryPreview.entryId);
            if (targetIndex < 0) {
                throw new Error(`改写目标条目不存在或已变更（id=${entryPreview.entryId}），请重新生成预览。`);
            }

            const current = entries[targetIndex];
            const currentFieldText = getEntryFieldText(current, entryPreview.field);
            if (currentFieldText !== entryPreview.beforeText) {
                throw new Error(`条目「${entryPreview.entryTitle}」的 ${entryPreview.field} 在预览后发生变化，请重新生成改写预览。`);
            }

            const nextEntry = applyPatchOperationsToEntry(current, entryPreview.operations);
            if (entryPreview.field === 'keysText') {
                const keys = normalizeKeywords(nextEntry.keysText);
                nextEntry.keys = keys;
                nextEntry.keysText = keys.join(', ');
            }

            entries.splice(targetIndex, 1, nextEntry);
            appliedEntries.push({
                entryId: String(nextEntry.id),
                entryTitle: nextEntry.name || nextEntry.comment || `条目 ${targetIndex + 1}`,
                field: entryPreview.field,
                changed: entryPreview.changed,
            });
            if (entryPreview.changed) changedCount += 1;
        });

        return {
            changedCount,
            affectedEntryCount: appliedEntries.length,
            operationCount: preview.operationCount || 0,
            entries: appliedEntries,
        };
    };

    return {
        isPatching,
        patchPreview,
        clearPatchPreview,
        generatePatchPreview,
        applyPatchPreviewToEditableData,
    };
}
