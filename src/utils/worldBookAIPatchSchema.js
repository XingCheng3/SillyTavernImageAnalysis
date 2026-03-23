import {
    TEXT_PATCH_ACTION,
    applyTextPatchOperation,
    applyTextPatchOperationsWithReport,
    buildTextPatchPreview,
    createTextPatchOperation,
    validateTextPatchOperation,
} from './structuredTextPatch.js';

export const WORLD_BOOK_PATCH_SCOPE = Object.freeze({
    ENTRY: 'entry',
    PARAGRAPH: 'paragraph',
    FIELD: 'field',
});

export const WORLD_BOOK_PATCH_MODE = Object.freeze({
    REWRITE: 'rewrite',
    REPLACE: 'replace',
    APPEND: 'append',
    PREPEND: 'prepend',
});

export const WORLD_BOOK_PATCH_ACTION = Object.freeze({
    REPLACE_TEXT: TEXT_PATCH_ACTION.REPLACE_TEXT,
    APPEND_AFTER_TEXT: TEXT_PATCH_ACTION.APPEND_AFTER_TEXT,
    PREPEND_BEFORE_TEXT: TEXT_PATCH_ACTION.PREPEND_BEFORE_TEXT,
    REPLACE_PARAGRAPH: TEXT_PATCH_ACTION.REPLACE_PARAGRAPH,
    REPLACE_WHOLE: TEXT_PATCH_ACTION.REPLACE_WHOLE,
});

export const WORLD_BOOK_PATCH_ALLOWED_FIELDS = ['content', 'comment', 'name', 'keysText'];

function normalizeString(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizeMultilineText(value) {
    return String(value ?? '').replace(/\r\n/g, '\n');
}

function splitParagraphs(content = '') {
    return normalizeString(content)
        .split(/\n{2,}/)
        .map(v => v.trim())
        .filter(Boolean);
}

function makeEntryTitle(entry = {}, index = 0) {
    return entry.name || entry.comment || `条目 ${index + 1}`;
}

export function getEntryParagraphs(entry = {}) {
    return splitParagraphs(entry.content || '');
}

export function findWorldBookEntryIndex(entries = [], entryId = '') {
    const target = normalizeString(entryId);
    if (!target) return -1;

    return entries.findIndex((entry) => normalizeString(entry?.id) === target);
}

export function createPatchInstruction(raw = {}) {
    const scope = raw.scope || WORLD_BOOK_PATCH_SCOPE.ENTRY;
    const mode = raw.mode || WORLD_BOOK_PATCH_MODE.REWRITE;

    return {
        entryId: normalizeString(raw.entryId),
        scope,
        mode,
        field: normalizeString(raw.field || 'content'),
        paragraphIndex: Number.isFinite(raw.paragraphIndex) ? Math.max(0, Math.trunc(raw.paragraphIndex)) : null,
        instruction: normalizeString(raw.instruction),
        replacement: normalizeMultilineText(raw.replacement),
        keepStyle: raw.keepStyle !== false,
        allowRelatedEntries: raw.allowRelatedEntries === true,
    };
}

export function validatePatchInstruction(raw = {}) {
    const instruction = createPatchInstruction(raw);
    const errors = [];

    if (!instruction.entryId) {
        errors.push({
            code: 'ENTRY_ID_REQUIRED',
            message: '局部改写必须指定 entryId。',
            path: 'entryId',
        });
    }

    if (!Object.values(WORLD_BOOK_PATCH_SCOPE).includes(instruction.scope)) {
        errors.push({
            code: 'INVALID_SCOPE',
            message: 'scope 仅支持 entry / paragraph / field。',
            path: 'scope',
        });
    }

    if (!Object.values(WORLD_BOOK_PATCH_MODE).includes(instruction.mode)) {
        errors.push({
            code: 'INVALID_MODE',
            message: 'mode 仅支持 rewrite / replace / append / prepend。',
            path: 'mode',
        });
    }

    if (!instruction.instruction && !instruction.replacement) {
        errors.push({
            code: 'INSTRUCTION_REQUIRED',
            message: 'instruction 或 replacement 至少需要提供一个。',
            path: 'instruction',
        });
    }

    if (instruction.scope === WORLD_BOOK_PATCH_SCOPE.PARAGRAPH && !Number.isFinite(instruction.paragraphIndex)) {
        errors.push({
            code: 'PARAGRAPH_INDEX_REQUIRED',
            message: 'paragraph scope 需要 paragraphIndex。',
            path: 'paragraphIndex',
        });
    }

    if (instruction.scope === WORLD_BOOK_PATCH_SCOPE.FIELD && !WORLD_BOOK_PATCH_ALLOWED_FIELDS.includes(instruction.field)) {
        errors.push({
            code: 'INVALID_FIELD',
            message: `field 仅支持 ${WORLD_BOOK_PATCH_ALLOWED_FIELDS.join(' / ')}。`,
            path: 'field',
        });
    }

    return {
        ok: errors.length === 0,
        errors,
        normalized: instruction,
    };
}

export function getEntryFieldText(entry = {}, field = 'content') {
    if (field === 'keysText') {
        if (normalizeString(entry.keysText)) {
            return normalizeMultilineText(entry.keysText);
        }
        if (Array.isArray(entry.keys) && entry.keys.length > 0) {
            return entry.keys.map(item => String(item ?? '').trim()).filter(Boolean).join(', ');
        }
        return '';
    }

    return normalizeMultilineText(entry?.[field] ?? '');
}

function setEntryFieldText(entry = {}, field = 'content', value = '') {
    const next = { ...entry };
    next[field] = normalizeMultilineText(value);
    if (field === 'keysText') {
        next.keysText = normalizeMultilineText(value);
    }
    return next;
}

export function createPatchOperation(raw = {}) {
    const textOperation = createTextPatchOperation(raw);

    return {
        ...textOperation,
        entryId: normalizeString(raw.entryId),
        field: normalizeString(raw.field || 'content'),
    };
}

export function validatePatchOperation(raw = {}, options = {}) {
    const operation = createPatchOperation(raw);
    const errors = [];

    if (!operation.entryId) {
        errors.push({
            code: 'PATCH_OPERATION_ENTRY_ID_REQUIRED',
            message: 'patch operation 必须指定 entryId。',
            path: 'entryId',
        });
    }

    if (!WORLD_BOOK_PATCH_ALLOWED_FIELDS.includes(operation.field)) {
        errors.push({
            code: 'PATCH_OPERATION_INVALID_FIELD',
            message: `patch operation field 仅支持 ${WORLD_BOOK_PATCH_ALLOWED_FIELDS.join(' / ')}。`,
            path: 'field',
        });
    }

    const textValidation = validateTextPatchOperation(operation);
    if (!textValidation.ok) {
        errors.push(...textValidation.errors);
    }

    if (options.focusEntryId && options.allowRelatedEntries !== true && operation.entryId && normalizeString(options.focusEntryId) !== operation.entryId) {
        errors.push({
            code: 'PATCH_OPERATION_RELATED_ENTRY_NOT_ALLOWED',
            message: '当前请求未开启关联条目修改，不允许修改其它 entryId。',
            path: 'entryId',
        });
    }

    if (Array.isArray(options.allowedEntryIds) && options.allowedEntryIds.length > 0 && operation.entryId) {
        const allowed = new Set(options.allowedEntryIds.map(item => normalizeString(item)).filter(Boolean));
        if (!allowed.has(operation.entryId)) {
            errors.push({
                code: 'PATCH_OPERATION_ENTRY_NOT_SELECTED',
                message: `patch operation 修改了未选中的条目：${operation.entryId}`,
                path: 'entryId',
            });
        }
    }

    if (Array.isArray(options.entries) && operation.entryId) {
        const targetIndex = findWorldBookEntryIndex(options.entries, operation.entryId);
        if (targetIndex < 0) {
            errors.push({
                code: 'PATCH_OPERATION_ENTRY_NOT_FOUND',
                message: `未找到条目 id=${operation.entryId}`,
                path: 'entryId',
            });
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        normalized: operation,
    };
}

function groupPatchOperationsByEntryField(operations = []) {
    const map = new Map();

    (operations || []).forEach((rawOperation) => {
        const operation = createPatchOperation(rawOperation);
        const key = `${operation.entryId}::${operation.field}`;
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(operation);
    });

    return Array.from(map.entries()).map(([key, ops]) => ({
        key,
        entryId: ops[0]?.entryId || '',
        field: ops[0]?.field || 'content',
        operations: ops,
    }));
}

export function validatePatchPlan(raw = {}, options = {}) {
    const plan = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw
        : { operations: Array.isArray(raw) ? raw : [] };

    const operations = Array.isArray(plan.operations) ? plan.operations : [];
    const errors = [];
    const normalizedOperations = [];

    if (!operations.length) {
        errors.push({
            code: 'PATCH_PLAN_EMPTY',
            message: 'AI 未返回任何 patch operations。',
            path: 'operations',
        });
    }

    operations.forEach((operation, index) => {
        const validation = validatePatchOperation(operation, options);
        if (!validation.ok) {
            validation.errors.forEach((error) => {
                errors.push({ ...error, path: `operations[${index}]${error.path ? `.${error.path}` : ''}` });
            });
            return;
        }
        normalizedOperations.push(validation.normalized);
    });

    return {
        ok: errors.length === 0,
        errors,
        normalized: {
            summary: normalizeString(plan.summary),
            selectedEntryIds: Array.isArray(plan.selectedEntryIds)
                ? plan.selectedEntryIds.map(item => normalizeString(item)).filter(Boolean)
                : [],
            operations: normalizedOperations,
        },
    };
}

export function applyPatchOperationToEntry(entry = {}, rawOperation = {}) {
    const operation = createPatchOperation(rawOperation);
    const beforeText = getEntryFieldText(entry, operation.field);
    const afterText = applyTextPatchOperation(beforeText, operation);
    return setEntryFieldText(entry, operation.field, afterText);
}

export function applyPatchOperationsToEntry(entry = {}, operations = []) {
    return (operations || []).reduce((current, operation) => applyPatchOperationToEntry(current, operation), { ...entry });
}

export function applyPatchOperationsToEntryWithReport(entry = {}, operations = [], options = {}) {
    const continueOnError = options?.continueOnError !== false;
    const sourceEntry = { ...entry };
    const groupedOperations = groupPatchOperationsByEntryField(operations);
    const fieldReports = [];
    let nextEntry = { ...sourceEntry };

    groupedOperations.forEach((group) => {
        const field = group.field || 'content';
        const beforeText = getEntryFieldText(nextEntry, field);
        const textReport = applyTextPatchOperationsWithReport(beforeText, group.operations, { continueOnError });

        if (textReport.successCount > 0 || textReport.changed) {
            nextEntry = setEntryFieldText(nextEntry, field, textReport.afterText);
        }

        fieldReports.push({
            entryId: group.entryId,
            field,
            beforeText,
            afterText: textReport.afterText,
            changed: textReport.changed,
            successCount: textReport.successCount,
            failedCount: textReport.failedCount,
            operationReports: textReport.operationReports,
            errors: textReport.errors,
        });
    });

    const failedOperations = fieldReports.flatMap((fieldReport) =>
        (fieldReport.operationReports || [])
            .filter(item => !item.ok)
            .map((item) => ({
                entryId: fieldReport.entryId,
                field: fieldReport.field,
                index: item.index,
                opId: item.operation?.opId || '',
                message: item.error?.message || '未知 patch 错误',
                operation: item.operation,
            })),
    );

    return {
        ok: failedOperations.length === 0,
        entry: nextEntry,
        changed: fieldReports.some(item => item.changed),
        successCount: fieldReports.reduce((sum, item) => sum + item.successCount, 0),
        failedCount: failedOperations.length,
        fieldReports,
        failedOperations,
    };
}

export function buildPatchPlanPreview(entries = [], operations = []) {
    const groups = groupPatchOperationsByEntryField(operations);
    const entryPreviews = groups.map((group) => {
        const entryIndex = findWorldBookEntryIndex(entries, group.entryId);
        if (entryIndex < 0) {
            throw new Error(`未找到条目 id=${group.entryId}`);
        }

        const entry = entries[entryIndex];
        const beforeText = getEntryFieldText(entry, group.field);
        const textReport = applyTextPatchOperationsWithReport(beforeText, group.operations, { continueOnError: true });

        return {
            entryId: String(entry.id),
            entryIndex,
            entryTitle: makeEntryTitle(entry, entryIndex),
            field: group.field,
            beforeText,
            afterText: textReport.afterText,
            changed: textReport.changed,
            operationSuccessCount: textReport.successCount,
            operationFailedCount: textReport.failedCount,
            operationReports: textReport.operationReports,
            operationErrors: textReport.errors,
            operations: group.operations,
        };
    }).sort((a, b) => a.entryIndex - b.entryIndex);

    const affectedEntryIds = Array.from(new Set(entryPreviews.map(item => item.entryId)));

    return {
        operationCount: operations.length,
        successOperationCount: entryPreviews.reduce((sum, item) => sum + (item.operationSuccessCount || 0), 0),
        failedOperationCount: entryPreviews.reduce((sum, item) => sum + (item.operationFailedCount || 0), 0),
        affectedEntryIds,
        affectedEntryCount: affectedEntryIds.length,
        entryPreviews,
    };
}

// -----------------------
// Legacy single-target helpers
// -----------------------
export function getPatchTargetText(entry = {}, patch = {}) {
    const normalizedPatch = createPatchInstruction(patch);

    if (normalizedPatch.field !== 'content') {
        return getEntryFieldText(entry, normalizedPatch.field);
    }

    const content = getEntryFieldText(entry, 'content');

    if (normalizedPatch.scope === WORLD_BOOK_PATCH_SCOPE.PARAGRAPH) {
        const paragraphs = splitParagraphs(content);
        const idx = normalizedPatch.paragraphIndex ?? 0;
        return paragraphs[idx] || '';
    }

    return content;
}

function applyLegacyPatchToField(fieldText = '', patch = {}) {
    const source = normalizeMultilineText(fieldText);
    const replacement = normalizeMultilineText(patch.replacement);

    if (patch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
        return [source, replacement].filter(Boolean).join(source ? '\n' : '');
    }

    if (patch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
        return [replacement, source].filter(Boolean).join(source ? '\n' : '');
    }

    return replacement || source;
}

export function applyLocalPatchToEntry(entry = {}, patch = {}) {
    const normalizedPatch = createPatchInstruction(patch);
    const next = { ...entry };

    if (normalizedPatch.field !== 'content') {
        const prevValue = getEntryFieldText(next, normalizedPatch.field);
        return setEntryFieldText(next, normalizedPatch.field, applyLegacyPatchToField(prevValue, normalizedPatch));
    }

    const content = getEntryFieldText(next, 'content');

    if (normalizedPatch.scope === WORLD_BOOK_PATCH_SCOPE.PARAGRAPH) {
        const paragraphs = splitParagraphs(content);
        const idx = normalizedPatch.paragraphIndex ?? 0;

        if (!paragraphs[idx]) {
            return next;
        }

        paragraphs[idx] = applyLegacyPatchToField(paragraphs[idx], normalizedPatch);
        next.content = paragraphs.join('\n\n');
        return next;
    }

    next.content = applyLegacyPatchToField(content, normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.APPEND || normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.PREPEND
        ? { ...normalizedPatch, replacement: normalizedPatch.replacement }
        : normalizedPatch,
    );

    if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
        next.content = [content, normalizedPatch.replacement].filter(Boolean).join(content ? '\n\n' : '');
    } else if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
        next.content = [normalizedPatch.replacement, content].filter(Boolean).join(content ? '\n\n' : '');
    }

    return next;
}

export function buildPatchPreview(entry = {}, patch = {}) {
    const normalizedPatch = createPatchInstruction(patch);
    const beforeText = getPatchTargetText(entry, normalizedPatch);
    const nextEntry = applyLocalPatchToEntry(entry, normalizedPatch);
    const afterText = getPatchTargetText(nextEntry, normalizedPatch);

    return {
        patch: normalizedPatch,
        beforeText,
        afterText,
        changed: beforeText !== afterText,
        nextEntry,
    };
}

export function buildTextFieldPatchPreview(entry = {}, field = 'content', operations = []) {
    const beforeText = getEntryFieldText(entry, field);
    const { afterText, changed } = buildTextPatchPreview(beforeText, operations);

    return {
        field,
        beforeText,
        afterText,
        changed,
    };
}
