const ENTRY_CONTENT_REQUIRED_CODE = 'ENTRY_CONTENT_REQUIRED';

function parseEntryIndexFromPath(path = '') {
    const match = String(path).match(/entries\[(\d+)\]\.content/);
    if (!match) return -1;
    const index = Number.parseInt(match[1], 10);
    return Number.isFinite(index) ? index : -1;
}

export function isRecoverableContentOnlyErrors(errors = []) {
    if (!Array.isArray(errors) || errors.length === 0) return false;
    return errors.every(error => error?.code === ENTRY_CONTENT_REQUIRED_CODE);
}

export function buildContentRetryFailures(errors = [], entries = [], fallbackMessage = '条目内容仍为空') {
    if (!Array.isArray(errors)) return [];

    const failuresById = new Map();

    errors.forEach((error) => {
        if (error?.code !== ENTRY_CONTENT_REQUIRED_CODE) {
            return;
        }

        const index = parseEntryIndexFromPath(error?.path || '');
        const entry = Number.isFinite(index) && index >= 0 ? entries[index] : null;
        const entryId = String(entry?.id ?? `idx_${index}`);
        const entryTitle = entry?.title || entry?.name || entry?.comment || `条目 ${index + 1}`;

        failuresById.set(entryId, {
            entryId,
            entryTitle,
            entryIndex: index,
            message: String(error?.message || fallbackMessage),
        });
    });

    return [...failuresById.values()];
}

export function mergeRetryFailureLists(...lists) {
    const merged = new Map();

    lists
        .filter(Array.isArray)
        .forEach((list) => {
            list.forEach((item) => {
                const id = String(item?.entryId || '');
                if (!id) return;

                const prev = merged.get(id) || {};
                merged.set(id, {
                    ...prev,
                    ...item,
                    entryId: id,
                    entryTitle: item?.entryTitle || prev.entryTitle || id,
                    message: item?.message || prev.message || '条目补全失败',
                });
            });
        });

    return [...merged.values()];
}
