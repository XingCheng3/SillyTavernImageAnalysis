export const TEXT_PATCH_ACTION = Object.freeze({
    REPLACE_TEXT: 'replace_text',
    APPEND_AFTER_TEXT: 'append_after_text',
    PREPEND_BEFORE_TEXT: 'prepend_before_text',
    REPLACE_PARAGRAPH: 'replace_paragraph',
    REPLACE_WHOLE: 'replace_whole',
});

function normalizeString(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizeAnchor(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function splitParagraphs(text = '') {
    return String(text ?? '')
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}/)
        .map(v => v.trim())
        .filter(Boolean);
}

export function createTextPatchOperation(raw = {}) {
    return {
        opId: normalizeString(raw.opId),
        action: raw.action || TEXT_PATCH_ACTION.REPLACE_TEXT,
        searchText: String(raw.searchText ?? '').replace(/\r\n/g, '\n'),
        replacement: String(raw.replacement ?? '').replace(/\r\n/g, '\n'),
        occurrence: Number.isFinite(raw.occurrence) ? Math.max(1, Math.trunc(raw.occurrence)) : null,
        paragraphIndex: Number.isFinite(raw.paragraphIndex) ? Math.max(0, Math.trunc(raw.paragraphIndex)) : null,
        anchors: {
            before: normalizeAnchor(raw?.anchors?.before),
            after: normalizeAnchor(raw?.anchors?.after),
        },
        reason: normalizeString(raw.reason),
    };
}

export function validateTextPatchOperation(raw = {}) {
    const operation = createTextPatchOperation(raw);
    const errors = [];

    if (!Object.values(TEXT_PATCH_ACTION).includes(operation.action)) {
        errors.push({
            code: 'INVALID_TEXT_PATCH_ACTION',
            message: '不支持的 text patch action。',
            path: 'action',
        });
    }

    if (operation.action === TEXT_PATCH_ACTION.REPLACE_PARAGRAPH && !Number.isFinite(operation.paragraphIndex)) {
        errors.push({
            code: 'PARAGRAPH_INDEX_REQUIRED',
            message: 'replace_paragraph 需要 paragraphIndex。',
            path: 'paragraphIndex',
        });
    }

    if ([
        TEXT_PATCH_ACTION.REPLACE_TEXT,
        TEXT_PATCH_ACTION.APPEND_AFTER_TEXT,
        TEXT_PATCH_ACTION.PREPEND_BEFORE_TEXT,
    ].includes(operation.action) && !operation.searchText) {
        errors.push({
            code: 'SEARCH_TEXT_REQUIRED',
            message: `${operation.action} 需要 searchText。`,
            path: 'searchText',
        });
    }

    if (!operation.replacement) {
        errors.push({
            code: 'REPLACEMENT_REQUIRED',
            message: `${operation.action} 需要 replacement。`,
            path: 'replacement',
        });
    }

    return {
        ok: errors.length === 0,
        errors,
        normalized: operation,
    };
}

function findSearchMatches(text = '', searchText = '') {
    const source = String(text ?? '').replace(/\r\n/g, '\n');
    const needle = String(searchText ?? '').replace(/\r\n/g, '\n');
    const matches = [];

    if (!needle) return matches;

    let start = 0;
    while (start <= source.length) {
        const index = source.indexOf(needle, start);
        if (index === -1) break;
        matches.push({
            index,
            end: index + needle.length,
            text: needle,
        });
        start = index + Math.max(needle.length, 1);
    }

    return matches;
}

function filterMatchesByAnchors(text = '', matches = [], anchors = {}) {
    const beforeAnchor = normalizeAnchor(anchors.before);
    const afterAnchor = normalizeAnchor(anchors.after);

    if (!beforeAnchor && !afterAnchor) {
        return matches;
    }

    return matches.filter((match) => {
        const beforeText = text.slice(0, match.index);
        const afterText = text.slice(match.end);
        const beforeOk = !beforeAnchor || beforeText.includes(beforeAnchor);
        const afterOk = !afterAnchor || afterText.includes(afterAnchor);
        return beforeOk && afterOk;
    });
}

export function resolveTextPatchTarget(text = '', rawOperation = {}) {
    const operation = createTextPatchOperation(rawOperation);
    const source = String(text ?? '').replace(/\r\n/g, '\n');

    if (operation.action === TEXT_PATCH_ACTION.REPLACE_WHOLE) {
        return {
            ok: true,
            target: {
                type: 'whole',
                start: 0,
                end: source.length,
                text: source,
            },
            normalized: operation,
        };
    }

    if (operation.action === TEXT_PATCH_ACTION.REPLACE_PARAGRAPH) {
        const paragraphs = splitParagraphs(source);
        const index = operation.paragraphIndex ?? 0;
        if (!paragraphs[index]) {
            return {
                ok: false,
                error: {
                    code: 'PARAGRAPH_NOT_FOUND',
                    message: `段落索引 ${index} 不存在。`,
                },
                normalized: operation,
            };
        }

        const targetText = paragraphs[index];
        const start = source.indexOf(targetText);
        return {
            ok: true,
            target: {
                type: 'paragraph',
                paragraphIndex: index,
                start,
                end: start + targetText.length,
                text: targetText,
            },
            normalized: operation,
        };
    }

    const allMatches = findSearchMatches(source, operation.searchText);
    if (!allMatches.length) {
        return {
            ok: false,
            error: {
                code: 'SEARCH_TEXT_NOT_FOUND',
                message: '未找到 searchText，对应文本可能已发生变化。',
            },
            normalized: operation,
        };
    }

    const filteredMatches = filterMatchesByAnchors(source, allMatches, operation.anchors);
    if (!filteredMatches.length) {
        return {
            ok: false,
            error: {
                code: 'SEARCH_TEXT_NOT_FOUND_BY_ANCHORS',
                message: '找到了 searchText，但不满足 anchors 限定。',
            },
            normalized: operation,
        };
    }

    let target = null;
    if (Number.isFinite(operation.occurrence)) {
        target = filteredMatches[operation.occurrence - 1] || null;
        if (!target) {
            return {
                ok: false,
                error: {
                    code: 'SEARCH_TEXT_OCCURRENCE_NOT_FOUND',
                    message: `searchText 第 ${operation.occurrence} 次出现不存在。`,
                },
                normalized: operation,
            };
        }
    } else if (filteredMatches.length === 1) {
        target = filteredMatches[0];
    } else {
        return {
            ok: false,
            error: {
                code: 'SEARCH_TEXT_AMBIGUOUS',
                message: `searchText 命中 ${filteredMatches.length} 处，请补充 occurrence 或 anchors。`,
            },
            normalized: operation,
        };
    }

    return {
        ok: true,
        target: {
            type: 'search',
            start: target.index,
            end: target.end,
            text: target.text,
        },
        normalized: operation,
    };
}

export function applyTextPatchOperation(text = '', rawOperation = {}) {
    const source = String(text ?? '').replace(/\r\n/g, '\n');
    const validation = validateTextPatchOperation(rawOperation);
    if (!validation.ok) {
        throw new Error(validation.errors.map(item => item.message).join('\n'));
    }

    const resolved = resolveTextPatchTarget(source, validation.normalized);
    if (!resolved.ok) {
        throw new Error(resolved.error.message);
    }

    const { target } = resolved;
    const operation = resolved.normalized;

    if (operation.action === TEXT_PATCH_ACTION.REPLACE_WHOLE || operation.action === TEXT_PATCH_ACTION.REPLACE_PARAGRAPH || operation.action === TEXT_PATCH_ACTION.REPLACE_TEXT) {
        return source.slice(0, target.start) + operation.replacement + source.slice(target.end);
    }

    if (operation.action === TEXT_PATCH_ACTION.APPEND_AFTER_TEXT) {
        return source.slice(0, target.end) + operation.replacement + source.slice(target.end);
    }

    if (operation.action === TEXT_PATCH_ACTION.PREPEND_BEFORE_TEXT) {
        return source.slice(0, target.start) + operation.replacement + source.slice(target.start);
    }

    return source;
}

export function applyTextPatchOperationWithResult(text = '', rawOperation = {}) {
    const beforeText = String(text ?? '').replace(/\r\n/g, '\n');
    const normalizedOperation = createTextPatchOperation(rawOperation);

    try {
        const afterText = applyTextPatchOperation(beforeText, normalizedOperation);
        return {
            ok: true,
            operation: normalizedOperation,
            beforeText,
            afterText,
            changed: beforeText !== afterText,
            error: null,
        };
    } catch (error) {
        return {
            ok: false,
            operation: normalizedOperation,
            beforeText,
            afterText: beforeText,
            changed: false,
            error: {
                message: error?.message || '未知 patch 错误',
            },
        };
    }
}

export function applyTextPatchOperationsWithReport(text = '', operations = [], options = {}) {
    const continueOnError = options?.continueOnError !== false;
    const initialText = String(text ?? '').replace(/\r\n/g, '\n');
    let currentText = initialText;
    const operationReports = [];

    for (let index = 0; index < (operations || []).length; index += 1) {
        const operation = operations[index];
        const result = applyTextPatchOperationWithResult(currentText, operation);
        const report = {
            ...result,
            index,
        };

        if (result.ok) {
            currentText = result.afterText;
        }

        operationReports.push(report);

        if (!result.ok && !continueOnError) {
            break;
        }
    }

    const successCount = operationReports.filter(item => item.ok).length;
    const failedReports = operationReports.filter(item => !item.ok);

    return {
        ok: failedReports.length === 0,
        beforeText: initialText,
        afterText: currentText,
        changed: initialText !== currentText,
        successCount,
        failedCount: failedReports.length,
        operationReports,
        errors: failedReports.map(item => ({
            index: item.index,
            opId: item.operation?.opId || '',
            message: item.error?.message || '未知 patch 错误',
        })),
    };
}

export function applyTextPatchOperations(text = '', operations = []) {
    const report = applyTextPatchOperationsWithReport(text, operations, { continueOnError: false });
    if (!report.ok) {
        const firstError = report.errors[0];
        throw new Error(firstError?.message || '文本 patch 执行失败');
    }
    return report.afterText;
}

export function buildTextPatchPreview(text = '', operations = []) {
    const report = applyTextPatchOperationsWithReport(text, operations, { continueOnError: false });
    return {
        beforeText: report.beforeText,
        afterText: report.afterText,
        changed: report.changed,
    };
}
