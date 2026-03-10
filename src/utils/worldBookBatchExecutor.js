import {
    buildWorldBookSystemPrompt,
    collectStreamBatchResults,
    parseWorldBookBatchResults,
} from '@/utils/worldBookTranslationWorkflow';

export async function executeWorldBookBatch({
    batchIndex,
    batchIndices,
    entries,
    editableData,
    fieldsToTranslate,
    useStream,
    apiSettings,
    translationConfig,
    buildTranslationPrompt,
    buildBookTranslationTags,
    bookStreamTranslate,
    bookRequestAbortControllers,
    cancelBookTranslationFlag,
    onStreamProgress,
}) {
    if (cancelBookTranslationFlag?.value) {
        return { status: 'cancelled' };
    }

    const { taggedText, fieldMap, totalTags } = buildBookTranslationTags(
        entries,
        batchIndices,
        fieldsToTranslate,
        editableData
    );

    if (!taggedText || totalTags === 0) {
        return {
            status: 'skipped',
            batchResults: {},
            missingTags: [],
            translatedItemsCount: 0,
        };
    }

    if (useStream) {
        const result = await bookStreamTranslate({
            apiUrl: apiSettings.url,
            apiKey: apiSettings.key,
            model: apiSettings.model,
            systemPrompt: buildWorldBookSystemPrompt(translationConfig, buildTranslationPrompt),
            userContent: taggedText,
            tagMap: fieldMap,
            onProgress: onStreamProgress,
        });

        if (cancelBookTranslationFlag?.value) {
            return { status: 'cancelled' };
        }

        if (!result.success) {
            return {
                status: 'error',
                error: result.error || '流式翻译失败',
            };
        }

        const batchResults = collectStreamBatchResults({
            fieldMap,
            streamResults: result.results,
        });
        const { missingTags } = parseWorldBookBatchResults({
            fieldMap,
            translatedText: Object.keys(result.results)
                .map(tag => `<${tag}>${result.results[tag]}</${tag}>`)
                .join('\n\n'),
        });

        return {
            status: 'success',
            batchResults,
            missingTags,
            translatedItemsCount: Object.keys(result.results).length,
        };
    }

    const batchAbortController = new AbortController();
    bookRequestAbortControllers.value.push(batchAbortController);

    try {
        const response = await fetch(apiSettings.url + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.key}`
            },
            signal: batchAbortController.signal,
            body: JSON.stringify({
                model: apiSettings.model,
                messages: [
                    {
                        role: 'system',
                        content: buildWorldBookSystemPrompt(translationConfig, buildTranslationPrompt)
                    },
                    { role: 'user', content: taggedText }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            const errorInfo = {
                status: response.status,
                statusText: response.statusText,
                ...errData.error
            };
            return {
                status: 'error',
                error: JSON.stringify(errorInfo, null, 2),
            };
        }

        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            return {
                status: 'error',
                error: 'API未返回任何结果',
            };
        }

        const translatedText = data.choices[0].message.content;
        const { batchResults, missingTags, expectedTags } = parseWorldBookBatchResults({
            fieldMap,
            translatedText,
        });

        return {
            status: 'success',
            translatedText,
            batchResults,
            missingTags,
            expectedTags,
            translatedItemsCount: Object.values(batchResults).reduce((sum, fields) => sum + Object.keys(fields).length, 0),
        };
    } finally {
        bookRequestAbortControllers.value = bookRequestAbortControllers.value.filter(controller => controller !== batchAbortController);
    }
}
