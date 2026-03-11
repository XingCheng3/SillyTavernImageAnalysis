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

function normalizeString(value) {
    return String(value ?? '').trim();
}

function splitParagraphs(content = '') {
    return normalizeString(content)
        .split(/\n{2,}/)
        .map(v => v.trim())
        .filter(Boolean);
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
        replacement: normalizeString(raw.replacement),
        keepStyle: raw.keepStyle !== false,
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

    return {
        ok: errors.length === 0,
        errors,
        normalized: instruction,
    };
}

export function applyLocalPatchToEntry(entry = {}, patch = {}) {
    const normalizedPatch = createPatchInstruction(patch);
    const next = { ...entry };

    if (normalizedPatch.field !== 'content') {
        const prevValue = normalizeString(next[normalizedPatch.field]);
        if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
            next[normalizedPatch.field] = [prevValue, normalizedPatch.replacement].filter(Boolean).join('\n');
        } else if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
            next[normalizedPatch.field] = [normalizedPatch.replacement, prevValue].filter(Boolean).join('\n');
        } else {
            next[normalizedPatch.field] = normalizedPatch.replacement || prevValue;
        }
        return next;
    }

    const content = normalizeString(next.content);

    if (normalizedPatch.scope === WORLD_BOOK_PATCH_SCOPE.PARAGRAPH) {
        const paragraphs = splitParagraphs(content);
        const idx = normalizedPatch.paragraphIndex ?? 0;

        if (!paragraphs[idx]) {
            return next;
        }

        if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
            paragraphs[idx] = [paragraphs[idx], normalizedPatch.replacement].filter(Boolean).join('\n');
        } else if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
            paragraphs[idx] = [normalizedPatch.replacement, paragraphs[idx]].filter(Boolean).join('\n');
        } else {
            paragraphs[idx] = normalizedPatch.replacement || paragraphs[idx];
        }

        next.content = paragraphs.join('\n\n');
        return next;
    }

    if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.APPEND) {
        next.content = [content, normalizedPatch.replacement].filter(Boolean).join('\n\n');
    } else if (normalizedPatch.mode === WORLD_BOOK_PATCH_MODE.PREPEND) {
        next.content = [normalizedPatch.replacement, content].filter(Boolean).join('\n\n');
    } else {
        next.content = normalizedPatch.replacement || content;
    }

    return next;
}
