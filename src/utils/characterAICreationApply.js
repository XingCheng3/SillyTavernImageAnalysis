import { CharacterCardUtils } from './characterCardParser.js';
import { validateCharacterDraft } from './characterAICreationValidator.js';

export function applyCardFieldsToTemplate(template, card = {}) {
    const data = template.data || {};

    data.name = card.name || data.name || '新角色';
    data.description = card.description || '';
    data.personality = card.personality || '';
    data.scenario = card.scenario || '';
    data.first_mes = card.first_message || '';
    data.alternate_greetings = Array.isArray(card.alternate_greetings)
        ? [...card.alternate_greetings]
        : [];
    data.creator_notes = card.creator_notes || '';
    data.system_prompt = card.system_prompt || '';
    data.post_history_instructions = card.post_history_instructions || '';
    data.mes_example = card.message_example || '';

    template.data = data;
    return template;
}

function normalizeBuildInput(rawDraft = {}) {
    if (!rawDraft || typeof rawDraft !== 'object') {
        return {};
    }

    if (rawDraft.worldbook || rawDraft.character_book || rawDraft?.card?.worldbook) {
        return rawDraft;
    }

    if (rawDraft.worldbookDraft && typeof rawDraft.worldbookDraft === 'object') {
        return {
            ...rawDraft,
            worldbook: rawDraft.worldbookDraft,
        };
    }

    return rawDraft;
}

export function buildCharacterTemplateFromDraft(normalizedDraft) {
    const validation = validateCharacterDraft(normalizeBuildInput(normalizedDraft));
    if (!validation.ok) {
        throw new Error(validation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
    }

    const template = CharacterCardUtils.createTemplate(validation.normalized.card.name || '新角色');
    applyCardFieldsToTemplate(template, validation.normalized.card);

    return {
        characterData: template,
        worldbookDraft: validation.normalized.worldbookDraft,
        warnings: validation.warnings,
    };
}
