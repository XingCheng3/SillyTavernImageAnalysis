import { ref } from 'vue';
import { normalizeKeywords } from '@/utils/worldBookAIAuthoringSpec';
import {
    applyPatchOperationsToEntry,
    buildPatchPlanPreview,
    findWorldBookEntryIndex,
    getEntryFieldText,
    getEntryParagraphs,
    validatePatchInstruction,
    validatePatchPlan,
} from '@/utils/worldBookAIPatchSchema';
import {
    buildWorldBookPatchSystemPrompt,
    buildWorldBookPatchUserPrompt,
} from '@/utils/worldBookAIPatchPrompt';
import {
    buildWorldBookPatchPlannerSystemPrompt,
    buildWorldBookPatchPlannerUserPrompt,
    validateWorldBookPatchPlannerResult,
} from '@/utils/worldBookAIPatchPlanner';
import {
    parseWorldBookPatchPlanResponse,
    parseWorldBookPatchPlannerResponse,
} from '@/utils/worldBookAIPatchResponse';
import { buildLineDiff, summarizeLineDiff } from '@/utils/textDiffPreview';

const PATCH_PLANNER_MAX_AFFECTED_ENTRIES = 6;

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

function createEntryPreviewWithDiff(item) {
    const lineDiff = buildLineDiff(item.beforeText, item.afterText);
    return {
        ...item,
        lineDiff,
        diffSummary: summarizeLineDiff(lineDiff),
    };
}

async function requestChatCompletion(apiSettings, { messages, temperature = 0.4 }) {
    const response = await fetch(`${apiSettings.value.url}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiSettings.value.key}`,
        },
        body: JSON.stringify({
            model: apiSettings.value.model,
            temperature,
            messages,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`改写请求失败（HTTP ${response.status}）：${text || response.statusText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
}

async function planRelatedEntries({ apiSettings, entries, targetEntry, patch }) {
    if (!patch.allowRelatedEntries) {
        return {
            summary: '仅修改当前聚焦条目',
            selectedEntryIds: [String(targetEntry.id)],
            targets: [{ entryId: String(targetEntry.id), reason: 'focus entry' }],
        };
    }

    const plannerContent = await requestChatCompletion(apiSettings, {
        temperature: 0.2,
        messages: [
            { role: 'system', content: buildWorldBookPatchPlannerSystemPrompt() },
            {
                role: 'user',
                content: buildWorldBookPatchPlannerUserPrompt({
                    entries,
                    focusEntry: targetEntry,
                    patch,
                    maxAffectedEntries: PATCH_PLANNER_MAX_AFFECTED_ENTRIES,
                }),
            },
        ],
    });

    const parsedPlanner = parseWorldBookPatchPlannerResponse(plannerContent);
    const plannerValidation = validateWorldBookPatchPlannerResult(parsedPlanner, {
        entries,
        focusEntryId: patch.entryId,
        allowRelatedEntries: patch.allowRelatedEntries,
        maxAffectedEntries: PATCH_PLANNER_MAX_AFFECTED_ENTRIES,
    });

    if (!plannerValidation.ok) {
        throw new Error(plannerValidation.errors.map(item => item.message).join('\n'));
    }

    return plannerValidation.normalized;
}

function getPlannedEntries(entries = [], planner = { selectedEntryIds: [] }) {
    const selectedIds = new Set((planner.selectedEntryIds || []).map(item => String(item)));
    return (entries || []).filter(entry => selectedIds.has(String(entry?.id ?? '')));
}

function buildPatchPreviewPayload(entries, planValidation, planner) {
    const preview = buildPatchPlanPreview(entries, planValidation.normalized.operations);
    const entryPreviews = preview.entryPreviews.map(createEntryPreviewWithDiff);

    return {
        summary: planValidation.normalized.summary || planner?.summary || '',
        selectedEntryIds: planner?.selectedEntryIds || planValidation.normalized.selectedEntryIds,
        planner,
        operationCount: preview.operationCount,
        affectedEntryIds: preview.affectedEntryIds,
        affectedEntryCount: preview.affectedEntryCount,
        entryPreviews,
        plan: planValidation.normalized,
        changed: entryPreviews.some(item => item.changed),
    };
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
            const planner = await planRelatedEntries({
                apiSettings,
                entries,
                targetEntry,
                patch: validation.normalized,
            });
            const plannedEntries = getPlannedEntries(entries, planner);

            const patchContent = await requestChatCompletion(apiSettings, {
                temperature: 0.4,
                messages: [
                    { role: 'system', content: buildWorldBookPatchSystemPrompt() },
                    {
                        role: 'user',
                        content: buildWorldBookPatchUserPrompt({
                            entries: plannedEntries,
                            focusEntry: targetEntry,
                            patch: validation.normalized,
                            planner,
                        }),
                    },
                ],
            });

            const parsedPlan = parseWorldBookPatchPlanResponse(patchContent, {
                validation,
                targetEntry,
            });
            const planValidation = validatePatchPlan(parsedPlan, {
                entries,
                focusEntryId: validation.normalized.entryId,
                allowRelatedEntries: validation.normalized.allowRelatedEntries,
                allowedEntryIds: planner.selectedEntryIds,
            });
            if (!planValidation.ok) {
                throw new Error(planValidation.errors.map(item => item.message).join('\n'));
            }

            patchPreview.value = buildPatchPreviewPayload(entries, planValidation, planner);

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
                    message: `planner 选中 ${planner.selectedEntryIds.length} 个条目，生成 ${patchPreview.value.operationCount} 个 patch 操作。`,
                    duration: 3800,
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
