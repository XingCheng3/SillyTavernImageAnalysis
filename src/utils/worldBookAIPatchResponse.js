import {
    WORLD_BOOK_PATCH_ACTION,
    WORLD_BOOK_PATCH_MODE,
    WORLD_BOOK_PATCH_SCOPE,
    createPatchInstruction,
    getPatchTargetText,
} from './worldBookAIPatchSchema.js';

function normalizeString(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function extractJsonText(raw = '') {
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

export function parseJsonObjectResponse(content = '') {
    const jsonText = extractJsonText(content);
    if (!jsonText) {
        throw new Error('AI 未返回有效 JSON。');
    }

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`AI 返回结果解析失败：${error.message}`);
    }
}

export function buildLegacyPatchPlanFromReplacement(parsed = {}, validation, targetEntry) {
    const replacement = normalizeString(parsed?.replacement);
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
            operations: [{ ...base, action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE }],
        };
    }

    if (patch.scope === WORLD_BOOK_PATCH_SCOPE.PARAGRAPH) {
        if (patch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
            return {
                summary: 'legacy replacement fallback',
                selectedEntryIds: [String(targetEntry?.id ?? '')],
                operations: [{
                    ...base,
                    action: WORLD_BOOK_PATCH_ACTION.APPEND_AFTER_TEXT,
                    searchText: targetText,
                    replacement: targetText ? `\n${replacement}` : replacement,
                    paragraphIndex: patch.paragraphIndex,
                }],
            };
        }

        if (patch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
            return {
                summary: 'legacy replacement fallback',
                selectedEntryIds: [String(targetEntry?.id ?? '')],
                operations: [{
                    ...base,
                    action: WORLD_BOOK_PATCH_ACTION.PREPEND_BEFORE_TEXT,
                    searchText: targetText,
                    replacement: targetText ? `${replacement}\n` : replacement,
                    paragraphIndex: patch.paragraphIndex,
                }],
            };
        }

        return {
            summary: 'legacy replacement fallback',
            selectedEntryIds: [String(targetEntry?.id ?? '')],
            operations: [{
                ...base,
                action: WORLD_BOOK_PATCH_ACTION.REPLACE_PARAGRAPH,
                paragraphIndex: patch.paragraphIndex,
            }],
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
                    : { ...base, action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE },
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
                    : { ...base, action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE },
            ],
        };
    }

    return {
        summary: 'legacy replacement fallback',
        selectedEntryIds: [String(targetEntry?.id ?? '')],
        operations: [{ ...base, action: WORLD_BOOK_PATCH_ACTION.REPLACE_WHOLE }],
    };
}

export function parseWorldBookPatchPlanResponse(content = '', { validation, targetEntry } = {}) {
    const parsed = parseJsonObjectResponse(content);
    if (parsed && typeof parsed === 'object' && typeof parsed.replacement === 'string') {
        return buildLegacyPatchPlanFromReplacement(parsed, validation, targetEntry);
    }
    return parsed;
}

export function parseWorldBookPatchPlannerResponse(content = '') {
    return parseJsonObjectResponse(content);
}
