export const WORLD_BOOK_CONTEXT_LIGHTS = Object.freeze({
    BLUE: 'blue',
    GREEN: 'green',
});

export const WORLD_BOOK_CONTEXT_LIGHT_LABELS = Object.freeze({
    [WORLD_BOOK_CONTEXT_LIGHTS.BLUE]: '蓝灯（关键词触发载入）',
    [WORLD_BOOK_CONTEXT_LIGHTS.GREEN]: '绿灯（直接载入上下文）',
});

export const WORLD_BOOK_DRAFT_SCHEMA = 'sillytavern.worldbook.ai.draft.v1';

export const WORLD_BOOK_DEFAULTS = Object.freeze({
    depth: 4,
    insertionOrderStep: 10,
    position: 'before_char',
    enabled: true,
    useProbability: true,
    probability: 100,
});

export function isValidContextLight(light) {
    return light === WORLD_BOOK_CONTEXT_LIGHTS.BLUE || light === WORLD_BOOK_CONTEXT_LIGHTS.GREEN;
}

/**
 * 兼容历史数据并推断灯类型。
 * 语义优先级：
 * 1) constant=true => 绿灯
 * 2) selective=true => 蓝灯
 * 3) 兼容旧数据：有 keys 时默认蓝灯，无 keys 默认绿灯
 */
export function inferContextLight(entry = {}) {
    if (entry.constant === true) return WORLD_BOOK_CONTEXT_LIGHTS.GREEN;
    if (entry.selective === true) return WORLD_BOOK_CONTEXT_LIGHTS.BLUE;

    const keys = normalizeKeywords(entry.keys || entry.keysText);
    return keys.length > 0 ? WORLD_BOOK_CONTEXT_LIGHTS.BLUE : WORLD_BOOK_CONTEXT_LIGHTS.GREEN;
}

export function applyContextLight(entry = {}, light = WORLD_BOOK_CONTEXT_LIGHTS.BLUE) {
    const next = { ...entry };

    if (light === WORLD_BOOK_CONTEXT_LIGHTS.GREEN) {
        next.constant = true;
        next.selective = false;
    } else {
        next.constant = false;
        next.selective = true;
    }

    return next;
}

export function normalizeKeywords(raw) {
    if (Array.isArray(raw)) {
        return raw
            .map(v => String(v ?? '').trim())
            .filter(Boolean);
    }

    if (typeof raw === 'string') {
        return raw
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
    }

    return [];
}

export function formatKeywordsText(keywords = []) {
    return normalizeKeywords(keywords).join(', ');
}

export function normalizeInsertionOrder(value, index = 0) {
    if (Number.isFinite(value)) {
        const parsed = Math.max(0, Math.trunc(value));
        return parsed;
    }

    return Math.max(0, index * WORLD_BOOK_DEFAULTS.insertionOrderStep);
}

export function normalizeDepth(value) {
    if (!Number.isFinite(value)) {
        return WORLD_BOOK_DEFAULTS.depth;
    }

    const parsed = Math.trunc(value);
    return Math.max(0, Math.min(100, parsed));
}

export function normalizePosition(value) {
    return value === 'after_char' ? 'after_char' : 'before_char';
}

export function getContextLightHint(light) {
    return WORLD_BOOK_CONTEXT_LIGHT_LABELS[light] || WORLD_BOOK_CONTEXT_LIGHT_LABELS[WORLD_BOOK_CONTEXT_LIGHTS.BLUE];
}
