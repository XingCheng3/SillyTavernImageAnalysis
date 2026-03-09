export function getSelectedBookIndices(selectedBookEntries) {
    return selectedBookEntries
        .map((selected, index) => selected ? index : -1)
        .filter(index => index !== -1);
}

export function getBookFieldsToTranslate(bookTranslateFields) {
    const fieldsToTranslate = [];
    if (bookTranslateFields.name) fieldsToTranslate.push('name');
    if (bookTranslateFields.keywords) fieldsToTranslate.push('keywords');
    if (bookTranslateFields.content) fieldsToTranslate.push('content');
    return fieldsToTranslate;
}

export function countBookTranslationItems({ editableData, batches, fieldsToTranslate }) {
    let totalItemsToTranslate = 0;

    batches.forEach(batchIndices => {
        batchIndices.forEach(entryIndex => {
            fieldsToTranslate.forEach(field => {
                const entry = editableData.book_entries[entryIndex];
                if ((field === 'name' && entry.name) ||
                    (field === 'keywords' && entry.keysText) ||
                    (field === 'content' && entry.content)) {
                    totalItemsToTranslate++;
                }
            });
        });
    });

    return totalItemsToTranslate;
}

export function collectBookBatchResults(bookBatchState) {
    const allResults = {};
    bookBatchState.batches.forEach(batch => {
        if (batch.status === 'success' && batch.results) {
            Object.assign(allResults, batch.results);
        }
    });
    return allResults;
}

export function getBookFieldLabel(field) {
    if (field === 'name') return '名称';
    if (field === 'keywords') return '关键词';
    return '内容';
}

export function buildWorldBookSystemPrompt(translationConfig, buildTranslationPrompt) {
    return buildTranslationPrompt(translationConfig, true) + '\nFor keyword lists separated by commas, translate each keyword and keep the comma separation.';
}

export function parseWorldBookBatchResults({ fieldMap, translatedText }) {
    const batchResults = {};
    const missingTags = [];
    const expectedTags = Object.keys(fieldMap);

    for (const [tag, info] of Object.entries(fieldMap)) {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = translatedText.match(regex);

        if (match && match[1]) {
            if (!batchResults[info.entryIndex]) {
                batchResults[info.entryIndex] = {};
            }
            batchResults[info.entryIndex][info.field] = match[1].trim();
        } else {
            missingTags.push({
                field: `${info.entryName} - ${getBookFieldLabel(info.field)}`,
                tag,
            });
        }
    }

    return {
        batchResults,
        missingTags,
        expectedTags,
    };
}

export function normalizeWorldBookMissingItems({ batchIndex, missingTags }) {
    return missingTags.map(({ field, tag }) => ({
        field: `批次${batchIndex + 1} - ${field}`,
        tag,
    }));
}

export function collectStreamBatchResults({ fieldMap, streamResults }) {
    const batchResults = {};
    for (const [tag, content] of Object.entries(streamResults)) {
        const info = fieldMap[tag];
        if (info) {
            if (!batchResults[info.entryIndex]) {
                batchResults[info.entryIndex] = {};
            }
            batchResults[info.entryIndex][info.field] = content;
        }
    }
    return batchResults;
}
