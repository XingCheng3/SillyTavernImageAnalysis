import {
    createWorldBookGenerationDraft,
} from './worldBookAIGenerationSchema.js';
import {
    validateGenerationInput,
    validateWorldBookGenerationDraft,
} from './worldBookAIGenerationValidator.js';
import { getCharacterDraftSchemaName } from './characterAICreationPrompt.js';

function normalizeString(value) {
    return String(value ?? '').trim();
}

function normalizeGreetings(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(item => normalizeString(item)).filter(Boolean);
}

export const CHARACTER_CREATE_GENERATION_MODES = Object.freeze({
    SINGLE: 'single',
    TWO_STEP: 'two_step',
});

export function validateCharacterCreateInput(input = {}) {
    const errors = [];
    const warnings = [];

    const corePrompt = normalizeString(input.corePrompt);
    if (!corePrompt) {
        errors.push({
            path: 'corePrompt',
            code: 'CORE_PROMPT_REQUIRED',
            message: '从 0 创建角色卡时必须提供核心提示词。',
        });
    }

    const generationMode = normalizeString(input.generationMode) || CHARACTER_CREATE_GENERATION_MODES.TWO_STEP;
    if (!Object.values(CHARACTER_CREATE_GENERATION_MODES).includes(generationMode)) {
        errors.push({
            path: 'generationMode',
            code: 'GENERATION_MODE_INVALID',
            message: `generationMode 仅支持 ${Object.values(CHARACTER_CREATE_GENERATION_MODES).join(' / ')}。`,
        });
    }

    const worldbookInputResult = validateGenerationInput({
        premise: corePrompt,
        targetEntryCount: input.targetEntryCount,
        openingCount: input.openingCount,
    });

    errors.push(...worldbookInputResult.errors);
    warnings.push(...worldbookInputResult.warnings);

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        normalized: {
            ...input,
            corePrompt,
            generationMode,
            targetEntryCount: worldbookInputResult.normalized.targetEntryCount,
            openingCount: worldbookInputResult.normalized.openingCount,
        },
    };
}

export function normalizeCharacterDraft(raw = {}) {
    const schema = normalizeString(raw.schema) || getCharacterDraftSchemaName();
    const card = raw.card || raw.character || {};
    const worldbook = raw.worldbook
        || raw.character_book
        || raw?.card?.worldbook
        || raw?.card?.character_book
        || raw?.character?.worldbook
        || raw?.character?.character_book
        || {};

    const normalizedCard = {
        name: normalizeString(card.name),
        description: normalizeString(card.description),
        personality: normalizeString(card.personality),
        scenario: normalizeString(card.scenario),
        first_message: normalizeString(card.first_message ?? card.first_mes),
        alternate_greetings: normalizeGreetings(card.alternate_greetings ?? card.alternateGreetings),
        creator_notes: normalizeString(card.creator_notes ?? card.creatorcomment ?? card.author_note),
        system_prompt: normalizeString(card.system_prompt ?? card.systemPrompt),
        post_history_instructions: normalizeString(card.post_history_instructions ?? card.postHistoryInstructions),
        message_example: normalizeString(card.message_example ?? card.mes_example),
    };

    const worldbookDraft = createWorldBookGenerationDraft(worldbook);

    return {
        schema,
        card: normalizedCard,
        worldbookDraft,
    };
}

export function validateCharacterDraft(raw = {}, options = {}) {
    const errors = [];
    const warnings = [];

    const requireWorldbookContent = options.requireWorldbookContent !== false;

    const normalized = normalizeCharacterDraft(raw);

    if (normalized.schema !== getCharacterDraftSchemaName()) {
        warnings.push({
            path: 'schema',
            code: 'SCHEMA_VERSION_MISMATCH',
            message: `草稿 schema=${normalized.schema}，已按 ${getCharacterDraftSchemaName()} 兼容处理。`,
        });
    }

    if (!normalized.card.name) {
        errors.push({
            path: 'card.name',
            code: 'CARD_NAME_REQUIRED',
            message: '角色名称不能为空。',
        });
    }

    if (!normalized.card.description && !normalized.card.personality) {
        warnings.push({
            path: 'card',
            code: 'CARD_PROFILE_THIN',
            message: '角色描述与性格同时为空，建议补充角色基础设定。',
        });
    }

    if (!normalized.card.first_message) {
        warnings.push({
            path: 'card.first_message',
            code: 'FIRST_MESSAGE_EMPTY',
            message: '首条开场白为空，建议至少提供 1 条。',
        });
    }

    if (!normalized.card.message_example) {
        warnings.push({
            path: 'card.message_example',
            code: 'MESSAGE_EXAMPLE_EMPTY',
            message: 'message_example 为空，建议至少提供 1 条包含占位符的示例。',
        });
    } else {
        if (!normalized.card.message_example.includes('{{user}}')) {
            errors.push({
                path: 'card.message_example',
                code: 'MESSAGE_EXAMPLE_USER_PLACEHOLDER_REQUIRED',
                message: 'message_example 必须包含 {{user}} 占位符。',
            });
        }

        if (!normalized.card.message_example.includes('{{char}}')) {
            errors.push({
                path: 'card.message_example',
                code: 'MESSAGE_EXAMPLE_CHAR_PLACEHOLDER_REQUIRED',
                message: 'message_example 必须包含 {{char}} 占位符。',
            });
        }
    }

    const worldbookResult = validateWorldBookGenerationDraft(normalized.worldbookDraft, {
        requireContent: requireWorldbookContent,
    });
    if (!worldbookResult.ok) {
        errors.push(...worldbookResult.errors.map(item => ({
            ...item,
            path: `worldbook.${item.path}`,
        })));
    }

    warnings.push(...worldbookResult.warnings.map(item => ({
        ...item,
        path: `worldbook.${item.path}`,
    })));

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        normalized: {
            ...normalized,
            worldbookDraft: worldbookResult.normalized,
        },
    };
}
