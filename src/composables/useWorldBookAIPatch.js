import { ref } from 'vue';
import { normalizeKeywords } from '@/utils/worldBookAIAuthoringSpec';
import {
    applyPatchOperationsToEntryWithReport,
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
    parseWorldBookPatchPlanResponse,
} from '@/utils/worldBookAIPatchResponse';
import { buildLineDiff, summarizeLineDiff } from '@/utils/textDiffPreview';

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
    const operationItems = (item.operationReports || []).map((report, index) => {
        const op = report.operation || item.operations?.[index] || {};
        return {
            ...op,
            index,
            selected: report.ok,
            ok: report.ok,
            errorMessage: report.error?.message || '',
            changed: report.changed,
        };
    });

    const selectedOperationCount = operationItems.filter(op => op.selected).length;

    return {
        ...item,
        lineDiff,
        diffSummary: summarizeLineDiff(lineDiff),
        operationItems,
        selectedOperationCount,
        selected: selectedOperationCount > 0,
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

function buildPatchPreviewPayload(entries, planValidation, selectedEntryIds = []) {
    const preview = buildPatchPlanPreview(entries, planValidation.normalized.operations);
    const entryPreviews = preview.entryPreviews.map(createEntryPreviewWithDiff);

    return {
        summary: planValidation.normalized.summary || '',
        selectedEntryIds,
        operationCount: preview.operationCount,
        successOperationCount: preview.successOperationCount,
        failedOperationCount: preview.failedOperationCount,
        affectedEntryIds: preview.affectedEntryIds,
        affectedEntryCount: preview.affectedEntryCount,
        entryPreviews,
        plan: planValidation.normalized,
        changed: entryPreviews.some(item => item.changed),
    };
}

function getSelectedEntries(entries = [], selectedEntryIds = []) {
    const selected = new Set((selectedEntryIds || []).map(item => String(item)));
    return (entries || []).filter(entry => selected.has(String(entry?.id ?? '')));
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
        const selectedEntryIds = validation.normalized.selectedEntryIds || [];
        const selectedEntries = getSelectedEntries(entries, selectedEntryIds);

        if (!selectedEntries.length) {
            throw new Error('请至少勾选一个有效条目后再改写。');
        }

        const missingEntryIds = selectedEntryIds.filter(entryId => findWorldBookEntryIndex(entries, entryId) < 0);
        if (missingEntryIds.length) {
            throw new Error(`以下条目不存在或已删除：${missingEntryIds.join(', ')}`);
        }

        const focusEntry = selectedEntries.find(item => String(item?.id ?? '') === validation.normalized.entryId)
            || selectedEntries[0];
        const patch = {
            ...validation.normalized,
            entryId: String(focusEntry?.id ?? ''),
            selectedEntryIds,
        };

        selectedEntries.forEach((entry) => ensureParagraphIndexInRange(entry, patch));

        isPatching.value = true;

        try {
            const patchContent = await requestChatCompletion(apiSettings, {
                temperature: 0.4,
                messages: [
                    { role: 'system', content: buildWorldBookPatchSystemPrompt() },
                    {
                        role: 'user',
                        content: buildWorldBookPatchUserPrompt({
                            entries: selectedEntries,
                            patch,
                            selectedEntryIds,
                        }),
                    },
                ],
            });

            const parsedPlan = parseWorldBookPatchPlanResponse(patchContent, {
                validation: { normalized: patch },
                targetEntry: focusEntry,
            });
            const planValidation = validatePatchPlan(parsedPlan, {
                entries,
                focusEntryId: patch.entryId,
                allowRelatedEntries: true,
                allowedEntryIds: selectedEntryIds,
            });
            if (!planValidation.ok) {
                throw new Error(planValidation.errors.map(item => item.message).join('\n'));
            }

            patchPreview.value = buildPatchPreviewPayload(entries, planValidation, selectedEntryIds);

            if (!patchPreview.value.changed) {
                showOperationNotice?.({
                    type: 'warning',
                    title: '改写预览生成成功（但内容未变化）',
                    message: '建议调整改写指令后重试。',
                    duration: 4500,
                });
            } else if (patchPreview.value.failedOperationCount > 0) {
                showOperationNotice?.({
                    type: 'warning',
                    title: '改写预览已生成（含失败操作）',
                    message: `共 ${patchPreview.value.operationCount} 个操作，其中 ${patchPreview.value.failedOperationCount} 个执行失败，请按需取消或重试。`,
                    duration: 5000,
                });
            } else {
                showOperationNotice?.({
                    type: 'success',
                    title: '改写预览已生成',
                    message: `已在 ${selectedEntryIds.length} 个勾选条目范围内生成 ${patchPreview.value.operationCount} 个 patch 操作。`,
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

        const selectedPreviews = preview.entryPreviews.filter((item) => {
            const operationItems = Array.isArray(item.operationItems) ? item.operationItems : [];
            if (!operationItems.length) {
                return item.selected !== false;
            }
            return operationItems.some(op => op.selected);
        });
        if (!selectedPreviews.length) {
            throw new Error('请先至少勾选一个要应用的操作。');
        }

        const entries = Array.isArray(editableData?.book_entries) ? editableData.book_entries : [];
        const appliedEntries = [];
        const failedOperations = [];
        let changedCount = 0;
        let attemptedOperationCount = 0;
        let successOperationCount = 0;
        let failedOperationCount = 0;

        selectedPreviews.forEach((entryPreview) => {
            const targetIndex = findWorldBookEntryIndex(entries, entryPreview.entryId);
            if (targetIndex < 0) {
                throw new Error(`改写目标条目不存在或已变更（id=${entryPreview.entryId}），请重新生成预览。`);
            }

            const current = entries[targetIndex];
            const currentFieldText = getEntryFieldText(current, entryPreview.field);
            if (currentFieldText !== entryPreview.beforeText) {
                throw new Error(`条目「${entryPreview.entryTitle}」的 ${entryPreview.field} 在预览后发生变化，请重新生成改写预览。`);
            }

            const operationItems = Array.isArray(entryPreview.operationItems) ? entryPreview.operationItems : [];
            const selectedOperations = (operationItems.length
                ? operationItems.filter(op => op.selected)
                : (entryPreview.selected !== false ? (entryPreview.operations || []) : []))
                .map(op => ({ ...op }));

            if (!selectedOperations.length) {
                return;
            }

            const report = applyPatchOperationsToEntryWithReport(current, selectedOperations, { continueOnError: true });
            const nextEntry = { ...report.entry };

            if (entryPreview.field === 'keysText') {
                const keys = normalizeKeywords(nextEntry.keysText);
                nextEntry.keys = keys;
                nextEntry.keysText = keys.join(', ');
            }

            entries.splice(targetIndex, 1, nextEntry);

            const afterFieldText = getEntryFieldText(nextEntry, entryPreview.field);
            const entryChanged = currentFieldText !== afterFieldText;
            if (entryChanged) changedCount += 1;

            attemptedOperationCount += selectedOperations.length;
            successOperationCount += report.successCount;
            failedOperationCount += report.failedCount;

            report.failedOperations.forEach((failed) => {
                failedOperations.push({
                    ...failed,
                    entryTitle: entryPreview.entryTitle,
                });
            });

            appliedEntries.push({
                entryId: String(nextEntry.id),
                entryTitle: nextEntry.name || nextEntry.comment || `条目 ${targetIndex + 1}`,
                field: entryPreview.field,
                changed: entryChanged,
                attemptedOperations: selectedOperations.length,
                successOperations: report.successCount,
                failedOperations: report.failedCount,
            });
        });

        if (!attemptedOperationCount) {
            throw new Error('请先至少勾选一个要应用的操作。');
        }

        return {
            changedCount,
            affectedEntryCount: appliedEntries.length,
            operationCount: attemptedOperationCount,
            successOperationCount,
            failedOperationCount,
            failedOperations,
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
