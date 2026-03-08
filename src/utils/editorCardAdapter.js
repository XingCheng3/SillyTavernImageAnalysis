import {
    SUPPORTED_SPECS,
    normalizeEditableBookEntry,
} from './characterCardParser.js';

function cloneDeep(value) {
    return JSON.parse(JSON.stringify(value));
}

export function detectCharacterSpec(characterData) {
    if (!characterData) return SUPPORTED_SPECS.V1;

    if (characterData.spec) {
        return characterData.spec;
    }

    const data = characterData.data || characterData;

    if (data.extensions || Array.isArray(data.lore) || Array.isArray(data.greetings)) {
        return SUPPORTED_SPECS.V3;
    }

    if (data.character_book || data.alternate_greetings) {
        return SUPPORTED_SPECS.V2;
    }

    return SUPPORTED_SPECS.V1;
}

export function isV3Spec(spec) {
    return typeof spec === 'string' && spec.includes('v3');
}

export function getSourceCharacterData(characterData) {
    return characterData?.data || characterData || null;
}

export function createEmptyCharacterBook(overrides = {}) {
    return {
        name: '世界书',
        description: '',
        scan_depth: 5,
        token_budget: 2048,
        entries: [],
        extensions: {},
        ...overrides,
    };
}

export function createEmptyBookEntry(index = 0, overrides = {}) {
    return normalizeEditableBookEntry({
        id: index,
        name: '新条目',
        comment: '新条目',
        keys: [],
        secondary_keys: [],
        content: '',
        enabled: true,
        insertion_order: 0,
        position: 'after_char',
        extensions: {
            display_index: index,
            depth: 4,
            probability: 100,
            useProbability: true,
            selectiveLogic: 0,
            group: '',
            group_override: false,
            group_weight: 100,
            scan_depth: null,
            case_sensitive: null,
            match_whole_words: null,
            use_group_scoring: null,
            exclude_recursion: false,
            prevent_recursion: false,
            delay_until_recursion: false,
            automation_id: '',
            role: 0,
            vectorized: false,
            sticky: null,
            cooldown: null,
            delay: null,
            match_persona_description: false,
            match_character_description: false,
            match_character_personality: false,
            match_character_depth_prompt: false,
            match_scenario: false,
            match_creator_notes: false,
            triggers: [],
            ignore_budget: false,
        },
        ...overrides,
    }, index);
}

export function hasEditableCharacterBook(editableData) {
    if (!editableData) return false;

    if (editableData.character_book) return true;
    if (Array.isArray(editableData.book_entries)) return true;
    if (Array.isArray(editableData.lore)) return true;

    return false;
}

export function buildEditableCharacterData(characterData) {
    const sourceData = getSourceCharacterData(characterData);
    if (!sourceData) return null;

    const editableData = cloneDeep(sourceData);

    if (editableData.first_mes && !editableData.first_message) {
        editableData.first_message = editableData.first_mes;
    }

    if (Array.isArray(editableData.greetings) && editableData.greetings.length > 0) {
        editableData.first_message = editableData.greetings[0];
        editableData.alternate_greetings = editableData.greetings.slice(1);
    } else {
        editableData.alternate_greetings = editableData.alternate_greetings || [];
    }

    if (editableData.mes_example && !editableData.message_example) {
        editableData.message_example = editableData.mes_example;
    }
    if (editableData.dialogue && !editableData.message_example) {
        editableData.message_example = editableData.dialogue;
    }

    const rawBookEntries = Array.isArray(editableData.lore)
        ? editableData.lore
        : (Array.isArray(editableData.character_book?.entries)
            ? editableData.character_book.entries
            : []);

    editableData.book_entries = rawBookEntries.map((entry, index) => normalizeEditableBookEntry(entry, index));
    editableData.character_book = editableData.character_book
        ? {
            ...createEmptyCharacterBook(),
            ...editableData.character_book,
            name: editableData.character_book.name || '世界书',
            description: editableData.character_book.description || '',
        }
        : createEmptyCharacterBook();

    return editableData;
}
