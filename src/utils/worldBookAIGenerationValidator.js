import { createEmptyBookEntry } from './editorCardAdapter.js';
import {
    WORLD_BOOK_CONTEXT_LIGHTS,
    WORLD_BOOK_DRAFT_SCHEMA,
    applyContextLight,
    formatKeywordsText,
    isValidContextLight,
    normalizeDepth,
    normalizeInsertionOrder,
    normalizeKeywords,
    normalizePosition,
} from './worldBookAIAuthoringSpec.js';
import {
    expandWorldBookGenerationDraft,
} from './worldBookAIGenerationSchema.js';

const MIN_CONTENT_LENGTH = 40;
const MAX_ENTRY_COUNT = 80;
const MAX_OPENING_COUNT = 10;

function pushIssue(bucket, issue) {
    bucket.push({
        path: issue.path || '',
        code: issue.code || 'UNKNOWN',
        message: issue.message || '未知问题',
    });
}

export function validateWorldBookGenerationDraft(draft, options = {}) {
    const errors = [];
    const warnings = [];
    const requireContent = options.requireContent !== false;

    const normalized = expandWorldBookGenerationDraft(draft || {});

    if (normalized.schema !== WORLD_BOOK_DRAFT_SCHEMA) {
        pushIssue(warnings, {
            path: 'schema',
            code: 'SCHEMA_VERSION_MISMATCH',
            message: `草稿 schema 为 ${normalized.schema}，期望 ${WORLD_BOOK_DRAFT_SCHEMA}。已按当前版本尝试兼容。`,
        });
    }

    const bookName = String(normalized.book?.name || '').trim();
    if (!bookName) {
        pushIssue(errors, {
            path: 'book.name',
            code: 'BOOK_NAME_REQUIRED',
            message: '世界书名称不能为空。',
        });
    }

    if (!Array.isArray(normalized.entries) || normalized.entries.length === 0) {
        pushIssue(errors, {
            path: 'entries',
            code: 'ENTRIES_REQUIRED',
            message: '至少需要 1 条世界书条目。',
        });
    }

    if (normalized.entries.length > MAX_ENTRY_COUNT) {
        pushIssue(errors, {
            path: 'entries',
            code: 'ENTRY_COUNT_EXCEEDED',
            message: `条目数量超过上限（${MAX_ENTRY_COUNT}）。`,
        });
    }

    const insertionOrderMap = new Map();
    const entryIds = new Set();

    normalized.entries.forEach((entry, index) => {
        const path = `entries[${index}]`;

        const title = String(entry.title || entry.comment || '').trim();
        if (!title) {
            pushIssue(errors, {
                path: `${path}.title`,
                code: 'ENTRY_TITLE_REQUIRED',
                message: '条目标题不能为空。',
            });
        }

        const light = entry.light;
        if (!isValidContextLight(light)) {
            pushIssue(errors, {
                path: `${path}.light`,
                code: 'INVALID_LIGHT_TYPE',
                message: `灯类型必须是 ${WORLD_BOOK_CONTEXT_LIGHTS.BLUE} 或 ${WORLD_BOOK_CONTEXT_LIGHTS.GREEN}。`,
            });
        }

        const keywords = normalizeKeywords(entry.keywords);
        if (light === WORLD_BOOK_CONTEXT_LIGHTS.BLUE && keywords.length === 0) {
            pushIssue(errors, {
                path: `${path}.keywords`,
                code: 'BLUE_LIGHT_KEYWORDS_REQUIRED',
                message: '蓝灯条目必须提供至少 1 个关键词。',
            });
        }

        const order = normalizeInsertionOrder(entry.insertionOrder, index);
        if (!insertionOrderMap.has(order)) {
            insertionOrderMap.set(order, []);
        }
        insertionOrderMap.get(order).push(index);

        const depth = normalizeDepth(entry.depth);
        if (depth !== entry.depth && Number.isFinite(entry.depth)) {
            pushIssue(warnings, {
                path: `${path}.depth`,
                code: 'DEPTH_NORMALIZED',
                message: `深度值 ${entry.depth} 已被归一化为 ${depth}。`,
            });
        }

        const position = normalizePosition(entry.position);
        if (position !== entry.position) {
            pushIssue(warnings, {
                path: `${path}.position`,
                code: 'POSITION_NORMALIZED',
                message: `position=${entry.position} 无效，已归一化为 ${position}。`,
            });
        }

        const id = String(entry.id || '').trim();
        if (!id) {
            pushIssue(errors, {
                path: `${path}.id`,
                code: 'ENTRY_ID_REQUIRED',
                message: '条目 id 不能为空。',
            });
        } else if (entryIds.has(id)) {
            pushIssue(errors, {
                path: `${path}.id`,
                code: 'ENTRY_ID_DUPLICATED',
                message: `条目 id ${id} 重复。`,
            });
        } else {
            entryIds.add(id);
        }

        if (requireContent) {
            const content = String(entry.content || '').trim();
            if (!content) {
                pushIssue(errors, {
                    path: `${path}.content`,
                    code: 'ENTRY_CONTENT_REQUIRED',
                    message: '条目内容不能为空。',
                });
            } else if (content.length < MIN_CONTENT_LENGTH) {
                pushIssue(warnings, {
                    path: `${path}.content`,
                    code: 'ENTRY_CONTENT_TOO_SHORT',
                    message: `条目内容偏短（${content.length} 字），建议至少 ${MIN_CONTENT_LENGTH} 字。`,
                });
            }
        }
    });

    insertionOrderMap.forEach((entryIndexes, order) => {
        if (entryIndexes.length > 1) {
            pushIssue(warnings, {
                path: 'entries',
                code: 'INSERTION_ORDER_DUPLICATED',
                message: `insertion_order=${order} 被多个条目复用（索引：${entryIndexes.join(', ')}）。`,
            });
        }
    });

    if (Array.isArray(normalized.openings) && normalized.openings.length > MAX_OPENING_COUNT) {
        pushIssue(warnings, {
            path: 'openings',
            code: 'OPENING_COUNT_TOO_MANY',
            message: `开场白分支超过建议上限（${MAX_OPENING_COUNT}）。`,
        });
    }

    normalized.openings.forEach((opening, index) => {
        const path = `openings[${index}]`;
        if (!String(opening.title || '').trim()) {
            pushIssue(errors, {
                path: `${path}.title`,
                code: 'OPENING_TITLE_REQUIRED',
                message: '开场白标题不能为空。',
            });
        }

        [...(opening.enableEntryIds || []), ...(opening.disableEntryIds || [])].forEach((entryId) => {
            if (!entryIds.has(String(entryId))) {
                pushIssue(warnings, {
                    path,
                    code: 'OPENING_ENTRY_REFERENCE_MISSING',
                    message: `开场白引用了不存在的条目 id：${entryId}`,
                });
            }
        });
    });

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        normalized,
    };
}

export function mapDraftEntriesToEditableEntries(entries = [], options = {}) {
    const startIndex = Number.isFinite(options.startIndex) ? Math.max(0, Math.trunc(options.startIndex)) : 0;
    const startOrder = Number.isFinite(options.startOrder) ? Math.max(0, Math.trunc(options.startOrder)) : 0;

    return entries.map((entry, index) => {
        const targetIndex = startIndex + index;
        const base = createEmptyBookEntry(targetIndex);

        const light = isValidContextLight(entry.light)
            ? entry.light
            : WORLD_BOOK_CONTEXT_LIGHTS.BLUE;

        const keys = normalizeKeywords(entry.keywords);
        const position = normalizePosition(entry.position);
        const depth = normalizeDepth(entry.depth);
        const insertionOrder = normalizeInsertionOrder(entry.insertionOrder, index) + startOrder;

        const withLight = applyContextLight({
            ...base,
            id: targetIndex,
            name: entry.title,
            comment: entry.comment || entry.title,
            keys,
            keysText: formatKeywordsText(keys),
            content: String(entry.content || '').trim(),
            enabled: entry.enabled !== false,
            insertion_order: insertionOrder,
            priority: insertionOrder,
            position,
            depth,
            scanDepth: depth,
            probability: 100,
            useProbability: true,
            extensions: {
                ...base.extensions,
                display_index: targetIndex,
                position: position === 'before_char' ? 0 : 1,
                depth,
                probability: 100,
                useProbability: true,
            },
        }, light);

        return withLight;
    });
}

export function validateGenerationInput(input = {}) {
    const errors = [];
    const warnings = [];

    const premise = String(input.premise || '').trim();
    if (!premise) {
        pushIssue(errors, {
            path: 'premise',
            code: 'PREMISE_REQUIRED',
            message: '生成世界书时必须提供世界观主线设定（premise）。',
        });
    }

    const targetEntryCount = Number(input.targetEntryCount ?? 0);
    if (!Number.isFinite(targetEntryCount) || targetEntryCount <= 0) {
        pushIssue(errors, {
            path: 'targetEntryCount',
            code: 'TARGET_ENTRY_COUNT_REQUIRED',
            message: 'targetEntryCount 必须是大于 0 的数字。',
        });
    } else if (targetEntryCount > MAX_ENTRY_COUNT) {
        pushIssue(errors, {
            path: 'targetEntryCount',
            code: 'TARGET_ENTRY_COUNT_EXCEEDED',
            message: `targetEntryCount 不能超过 ${MAX_ENTRY_COUNT}。`,
        });
    } else if (targetEntryCount > 20) {
        pushIssue(warnings, {
            path: 'targetEntryCount',
            code: 'TARGET_ENTRY_COUNT_HIGH',
            message: '单次生成条目数较高，建议分批生成以降低失败率。',
        });
    }

    const openingCount = Number(input.openingCount ?? 0);
    if (Number.isFinite(openingCount) && openingCount > 5) {
        pushIssue(warnings, {
            path: 'openingCount',
            code: 'OPENING_COUNT_HIGH',
            message: '开场白分支建议控制在 3~5 个。',
        });
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        normalized: {
            ...input,
            premise,
            targetEntryCount,
            openingCount: Number.isFinite(openingCount) ? openingCount : 0,
        },
    };
}
