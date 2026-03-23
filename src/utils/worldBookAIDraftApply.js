import { createEmptyCharacterBook } from './editorCardAdapter.js';
import {
    mapDraftEntriesToEditableEntries,
    validateWorldBookGenerationDraft,
} from './worldBookAIGenerationValidator.js';

function getNextStartId(entries = []) {
    let maxId = -1;
    entries.forEach((entry) => {
        const parsed = Number.parseInt(entry?.id, 10);
        if (Number.isFinite(parsed)) {
            maxId = Math.max(maxId, parsed);
        }
    });
    return maxId + 1;
}

function getNextStartOrder(entries = []) {
    let maxOrder = -10;
    entries.forEach((entry) => {
        const candidate = Number.isFinite(entry?.insertion_order)
            ? entry.insertion_order
            : entry?.priority;

        if (Number.isFinite(candidate)) {
            maxOrder = Math.max(maxOrder, candidate);
        }
    });

    return maxOrder + 10;
}

function buildValidationSummary(result) {
    const warningText = result.warnings.map(item => `- ${item.path}: ${item.message}`).join('\n');
    return {
        warningText,
        warningCount: result.warnings.length,
        errorCount: result.errors.length,
    };
}

function normalizeOpeningBranches(openings = [], idMap = new Map(), allowedSourceEntryIds = null) {
    const allowedSet = allowedSourceEntryIds instanceof Set ? allowedSourceEntryIds : null;

    return (Array.isArray(openings) ? openings : []).map((opening, index) => {
        const enableEntryIds = (opening.enableEntryIds || [])
            .map((id) => String(id))
            .filter((id) => !allowedSet || allowedSet.has(id))
            .map((id) => idMap.get(id) || id);

        const disableEntryIds = (opening.disableEntryIds || [])
            .map((id) => String(id))
            .filter((id) => !allowedSet || allowedSet.has(id))
            .map((id) => idMap.get(id) || id);

        return {
            id: String(opening.id || `OP${index + 1}`),
            title: String(opening.title || `开场白 ${index + 1}`),
            text: String(opening.text || '').trim(),
            enableEntryIds,
            disableEntryIds,
        };
    });
}

export function applyWorldBookDraftToEditableData(editableData, draft, options = {}) {
    const validation = validateWorldBookGenerationDraft(draft, { requireContent: true });
    if (!validation.ok) {
        const message = validation.errors.map(item => `${item.path}: ${item.message}`).join('\n');
        throw new Error(message || '草稿结构不合法，无法应用。');
    }

    if (!editableData) {
        throw new Error('未检测到可编辑角色卡数据。');
    }

    if (!editableData.character_book) {
        editableData.character_book = createEmptyCharacterBook();
    }

    const replaceExisting = options.replaceExisting === true;
    const selectedDraftEntryIds = Array.isArray(options.selectedDraftEntryIds)
        ? Array.from(new Set(options.selectedDraftEntryIds.map(item => String(item)).filter(Boolean)))
        : [];

    const normalizedEntries = Array.isArray(validation.normalized.entries) ? validation.normalized.entries : [];
    const selectedEntrySet = selectedDraftEntryIds.length ? new Set(selectedDraftEntryIds) : null;
    const entriesToApply = selectedEntrySet
        ? normalizedEntries.filter(entry => selectedEntrySet.has(String(entry.id)))
        : normalizedEntries;

    if (!entriesToApply.length) {
        throw new Error('草稿中没有可应用的条目（请至少勾选 1 条）。');
    }

    const currentEntries = Array.isArray(editableData.book_entries) ? editableData.book_entries : [];
    const startIndex = replaceExisting ? 0 : currentEntries.length;
    const startId = replaceExisting ? 0 : getNextStartId(currentEntries);
    const startOrder = replaceExisting ? 0 : getNextStartOrder(currentEntries);

    const mappedEntries = mapDraftEntriesToEditableEntries(entriesToApply, {
        startIndex,
        startId,
        startOrder,
    });

    editableData.character_book.name = validation.normalized.book.name || editableData.character_book.name || '世界书';
    editableData.character_book.description = validation.normalized.book.description || editableData.character_book.description || '';

    editableData.book_entries = replaceExisting
        ? mappedEntries
        : [...currentEntries, ...mappedEntries];

    const idMap = new Map();
    entriesToApply.forEach((entry, index) => {
        idMap.set(String(entry.id), String(mappedEntries[index]?.id));
    });

    const openingBranches = normalizeOpeningBranches(
        validation.normalized.openings,
        idMap,
        selectedEntrySet,
    );

    if (!editableData.character_book.extensions || typeof editableData.character_book.extensions !== 'object') {
        editableData.character_book.extensions = {};
    }

    editableData.character_book.extensions.ai_opening_branches = openingBranches;
    editableData.character_book.extensions.ai_opening_updated_at = new Date().toISOString();
    editableData.character_book.extensions.ai_opening_schema = 'sillytavern.worldbook.ai.openings.v1';

    const applyOpeningsToGreetings = options.applyOpeningsToGreetings !== false;
    const openingTexts = openingBranches
        .map(item => item.text)
        .filter(Boolean);

    if (applyOpeningsToGreetings && openingTexts.length > 0) {
        editableData.first_message = openingTexts[0];
        editableData.alternate_greetings = openingTexts.slice(1);
    }

    const summary = buildValidationSummary(validation);

    return {
        replaced: replaceExisting,
        addedCount: mappedEntries.length,
        totalCount: editableData.book_entries.length,
        openingCount: openingBranches.length,
        greetingsSyncedCount: applyOpeningsToGreetings ? openingTexts.length : 0,
        warnings: validation.warnings,
        ...summary,
    };
}
