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
