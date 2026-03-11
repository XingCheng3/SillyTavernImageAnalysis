import { ref } from 'vue';
import { normalizeKeywords } from '@/utils/worldBookAIAuthoringSpec';
import {
    buildPatchPreview,
    createPatchInstruction,
    findWorldBookEntryIndex,
    getPatchTargetText,
    getEntryParagraphs,
    validatePatchInstruction,
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

function parsePatchResponse(content = '') {
    const jsonText = extractJsonText(content);
    if (!jsonText) {
        throw new Error('AI 未返回有效改写结果。');
    }

    try {
        const parsed = JSON.parse(jsonText);
        const replacement = String(parsed?.replacement ?? '').trim();
        if (!replacement) {
            throw new Error('AI 返回的 replacement 为空。');
        }
        return replacement;
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

        const targetText = getPatchTargetText(targetEntry, validation.normalized);
        if (!targetText) {
            throw new Error('目标内容为空，无法执行 AI 改写。');
        }

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
                    temperature: 0.7,
                    messages: [
                        { role: 'system', content: buildWorldBookPatchSystemPrompt() },
                        {
                            role: 'user',
                            content: buildWorldBookPatchUserPrompt({
                                entry: targetEntry,
                                patch: validation.normalized,
                                targetText,
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
            const replacement = parsePatchResponse(content);

            const mergedPatch = createPatchInstruction({
                ...validation.normalized,
                replacement,
            });

            const preview = buildPatchPreview(targetEntry, mergedPatch);
            const lineDiff = buildLineDiff(preview.beforeText, preview.afterText);

            patchPreview.value = {
                entryId: String(targetEntry.id),
                entryIndex: targetIndex,
                entryTitle: targetEntry.name || targetEntry.comment || `条目 ${targetIndex + 1}`,
                patch: mergedPatch,
                beforeText: preview.beforeText,
                afterText: preview.afterText,
                lineDiff,
                diffSummary: summarizeLineDiff(lineDiff),
                changed: preview.changed,
                nextEntry: preview.nextEntry,
            };

            if (!preview.changed) {
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
                    message: `目标条目：${patchPreview.value.entryTitle}`,
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
        if (!preview) {
            throw new Error('没有可应用的改写预览。');
        }

        const entries = Array.isArray(editableData?.book_entries) ? editableData.book_entries : [];
        const targetIndex = Number.isFinite(preview.entryIndex) ? preview.entryIndex : -1;
        if (targetIndex < 0 || targetIndex >= entries.length) {
            throw new Error('改写目标条目不存在或已变更，请重新生成预览。');
        }

        const current = entries[targetIndex];
        const expectedId = String(preview.entryId || '');
        if (expectedId && String(current?.id ?? '') !== expectedId) {
            throw new Error('目标条目已变化，请重新生成改写预览。');
        }

        const nextEntry = { ...preview.nextEntry };

        if (preview.patch?.field === 'keysText') {
            const keys = normalizeKeywords(nextEntry.keysText);
            nextEntry.keys = keys;
            nextEntry.keysText = keys.join(', ');
        }

        editableData.book_entries.splice(targetIndex, 1, nextEntry);

        return {
            entryIndex: targetIndex,
            entryId: String(nextEntry.id),
            entryTitle: nextEntry.name || nextEntry.comment || `条目 ${targetIndex + 1}`,
            field: preview.patch?.field || 'content',
            changed: preview.changed,
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
