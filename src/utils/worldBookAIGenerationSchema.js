import {
    WORLD_BOOK_DRAFT_SCHEMA,
    WORLD_BOOK_CONTEXT_LIGHTS,
    inferContextLight,
    isValidContextLight,
    normalizeDepth,
    normalizeInsertionOrder,
    normalizeKeywords,
    normalizePosition,
} from './worldBookAIAuthoringSpec.js';

const POSITION_TO_SHORT = Object.freeze({
    before_char: 'b',
    after_char: 'a',
});

const SHORT_TO_POSITION = Object.freeze({
    b: 'before_char',
    a: 'after_char',
});

function normalizeEntryTitle(entry = {}, index = 0) {
    const title = String(
        entry.title
        ?? entry.comment
        ?? entry.name
        ?? `条目 ${index + 1}`
    ).trim();

    return title || `条目 ${index + 1}`;
}

function normalizeLight(entry = {}) {
    const light = entry.light || entry.lt;
    if (isValidContextLight(light)) return light;
    return inferContextLight(entry);
}

function normalizeEntryId(entry = {}, index = 0) {
    const id = entry.id ?? entry.entryId ?? entry.eid;
    if (id === undefined || id === null || id === '') {
        return `E${String(index + 1).padStart(2, '0')}`;
    }
    return String(id);
}

export function createCompactEntryDraft(entry = {}, index = 0) {
    const light = normalizeLight(entry);
    const position = normalizePosition(entry.position || entry.ps || 'before_char');

    return {
        id: normalizeEntryId(entry, index),
        c: normalizeEntryTitle(entry, index),
        k: normalizeKeywords(entry.keywords ?? entry.keys ?? entry.k),
        lt: light,
        io: normalizeInsertionOrder(entry.insertionOrder ?? entry.insertion_order ?? entry.io, index),
        dp: normalizeDepth(entry.depth ?? entry.dp),
        ps: POSITION_TO_SHORT[position],
        en: entry.enabled !== false,
        sm: String(entry.summary ?? entry.sm ?? '').trim(),
        ct: String(entry.content ?? entry.ct ?? '').trim(),
    };
}

export function expandCompactEntryDraft(entry = {}, index = 0) {
    const compact = createCompactEntryDraft(entry, index);
    return {
        id: compact.id,
        title: compact.c,
        comment: compact.c,
        keywords: compact.k,
        light: compact.lt,
        insertionOrder: compact.io,
        depth: compact.dp,
        position: SHORT_TO_POSITION[compact.ps] || 'before_char',
        enabled: compact.en !== false,
        summary: compact.sm,
        content: compact.ct,
    };
}

export function createCompactOpenings(openings = []) {
    return openings.map((opening, index) => ({
        id: String(opening.id ?? `OP${index + 1}`),
        t: String(opening.title ?? opening.t ?? `开场 ${index + 1}`).trim(),
        tx: String(opening.text ?? opening.tx ?? '').trim(),
        en: Array.isArray(opening.enableEntryIds ?? opening.en)
            ? [...(opening.enableEntryIds ?? opening.en)].map(v => String(v))
            : [],
        dis: Array.isArray(opening.disableEntryIds ?? opening.dis)
            ? [...(opening.disableEntryIds ?? opening.dis)].map(v => String(v))
            : [],
    }));
}

export function expandCompactOpenings(openings = []) {
    return createCompactOpenings(openings).map(opening => ({
        id: opening.id,
        title: opening.t,
        text: opening.tx,
        enableEntryIds: opening.en,
        disableEntryIds: opening.dis,
    }));
}

function normalizeCollection(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
        return Object.values(raw);
    }
    return [];
}

export function createWorldBookGenerationDraft(payload = {}) {
    const rawEntries = payload.entries ?? payload.book_entries ?? payload.bookEntries;
    const rawOpenings = payload.openings ?? payload.opening_branches ?? payload.openingBranches;
    const entries = normalizeCollection(rawEntries);
    const openings = normalizeCollection(rawOpenings);

    return {
        schema: WORLD_BOOK_DRAFT_SCHEMA,
        book: {
            name: String(payload.book?.name ?? payload.name ?? 'AI 生成世界书').trim(),
            description: String(payload.book?.description ?? payload.description ?? '').trim(),
            genre: String(payload.book?.genre ?? payload.genre ?? '').trim(),
            style: String(payload.book?.style ?? payload.style ?? '').trim(),
        },
        generation: {
            language: String(payload.generation?.language ?? payload.language ?? 'zh-CN').trim(),
            targetEntryCount: Number(payload.generation?.targetEntryCount ?? payload.targetEntryCount ?? entries.length ?? 0),
            openingCount: Number(payload.generation?.openingCount ?? payload.openingCount ?? openings.length ?? 0),
            notes: String(payload.generation?.notes ?? payload.notes ?? '').trim(),
        },
        entries: entries.map((entry, index) => createCompactEntryDraft(entry, index)),
        openings: createCompactOpenings(openings),
    };
}

export function expandWorldBookGenerationDraft(draft = {}) {
    const normalized = createWorldBookGenerationDraft(draft);

    return {
        schema: normalized.schema,
        book: { ...normalized.book },
        generation: { ...normalized.generation },
        entries: normalized.entries.map((entry, index) => expandCompactEntryDraft(entry, index)),
        openings: expandCompactOpenings(normalized.openings),
    };
}

export function createDraftPreviewText(draft = {}) {
    const normalized = expandWorldBookGenerationDraft(draft);

    const lines = [
        `世界书：${normalized.book.name || '未命名'}`,
        `条目数：${normalized.entries.length}`,
        `开场白分支数：${normalized.openings.length}`,
    ];

    normalized.entries.forEach((entry, index) => {
        lines.push(`${index + 1}. [${entry.light}] ${entry.title} | keys=${entry.keywords.length} | order=${entry.insertionOrder} | depth=${entry.depth}`);
    });

    return lines.join('\n');
}

export function getCompactSchemaExample() {
    return {
        schema: WORLD_BOOK_DRAFT_SCHEMA,
        book: {
            name: '异世界学院都市',
            description: '高压军校 + 异次元裂缝背景',
            genre: '异世界/学院/战斗',
            style: '高张力、快节奏、带都市科技感',
        },
        generation: {
            language: 'zh-CN',
            targetEntryCount: 16,
            openingCount: 4,
            notes: '蓝灯必须提供关键词，绿灯用于常驻规则。',
        },
        entries: [
            {
                id: 'E01',
                c: '世界观总览',
                k: ['裂缝时代', '地球联邦'],
                lt: WORLD_BOOK_CONTEXT_LIGHTS.GREEN,
                io: 10,
                dp: 4,
                ps: 'b',
                en: true,
                sm: '定义宏观背景和社会秩序。',
                ct: '（生成内容）',
            },
        ],
        openings: [
            {
                id: 'OP1',
                t: '高压觉醒仪式',
                tx: '（开场白正文）',
                en: ['E11'],
                dis: ['E12', 'E13'],
            },
        ],
    };
}
