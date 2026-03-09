import {
    buildWorldBookSystemPrompt,
    collectStreamBatchResults,
    getBookFieldsToTranslate,
    parseWorldBookBatchResults,
} from '@/utils/worldBookTranslationWorkflow';

export function useWorldBookActions({
    editableData,
    selectedBookEntries,
    bookTranslateFields,
    bookBatchTranslateModalRef,
    bookBatchState,
    bookStreamTranslate,
    cancelBookStream,
    bookRequestAbortControllers,
    bookStreamResults,
    bookTranslationErrors,
    bookTranslationMissingTags,
    cancelBookTranslationFlag,
    showBookBatchTranslateModal,
    isBookTranslating,
    isBookTranslationComplete,
    isBookTranslationError,
    canRetryBookTranslation,
    apiSettings,
    translationConfig,
    checkAndPromptApiConfig,
    buildTranslationPrompt,
    buildBookTranslationTags,
    showOperationNotice,
    stopTimeTracking,
}) {
    const selectAllBookEntries = () => {
        if (editableData.value.book_entries) {
            selectedBookEntries.value = new Array(editableData.value.book_entries.length).fill(true);
        }
    };

    const deselectAllBookEntries = () => {
        selectedBookEntries.value = [];
    };

    const cancelBookTranslation = () => {
        cancelBookTranslationFlag.value = true;
        isBookTranslating.value = false;
        isBookTranslationComplete.value = false;

        cancelBookStream();
        bookRequestAbortControllers.value.forEach(controller => controller.abort());
        bookRequestAbortControllers.value = [];
        stopTimeTracking();
        showOperationNotice({ type: 'info', title: '已取消世界书翻译', message: '未完成的翻译批次已停止。' });
    };

    const closeBookBatchTranslateModal = () => {
        showBookBatchTranslateModal.value = false;
        isBookTranslating.value = false;
        isBookTranslationComplete.value = false;
        isBookTranslationError.value = false;
        canRetryBookTranslation.value = false;
        bookTranslationErrors.value = [];
        bookTranslationMissingTags.value = [];
        cancelBookTranslationFlag.value = false;
        selectedBookEntries.value = [];
        bookStreamResults.value = [];
        bookRequestAbortControllers.value = [];
        bookBatchState.init(0, []);
        stopTimeTracking();
    };

    const retryBookBatch = async (batchIndex) => {
        console.log(`🔄 重试批次 ${batchIndex + 1}`);

        if (!checkAndPromptApiConfig()) {
            return;
        }

        const modalSettings = bookBatchTranslateModalRef.value;
        const useStream = modalSettings?.useStreamTranslation ?? false;

        const batchIndices = bookBatchState.getBatchData(batchIndex);
        if (!batchIndices || batchIndices.length === 0) {
            showOperationNotice({
                type: 'warning',
                title: '无法获取批次数据',
                message: '这个批次的上下文数据不存在，请重新发起翻译。',
            });
            return;
        }

        bookTranslationErrors.value = bookTranslationErrors.value.filter(
            err => !err.field.startsWith(`批次 ${batchIndex + 1}`) && !err.field.startsWith(`批次${batchIndex + 1}`)
        );

        bookStreamResults.value = bookStreamResults.value.filter(item => item.batchIndex !== batchIndex);

        const fieldsToTranslate = getBookFieldsToTranslate(bookTranslateFields);

        bookBatchState.setBatchStatus(batchIndex, 'translating');

        try {
            const { taggedText, fieldMap, totalTags } = buildBookTranslationTags(
                editableData.value.book_entries,
                batchIndices,
                fieldsToTranslate,
                editableData.value
            );

            if (!taggedText || totalTags === 0) {
                bookBatchState.setBatchStatus(batchIndex, 'success', { results: {} });
                return;
            }

            if (useStream) {
                const result = await bookStreamTranslate({
                    apiUrl: apiSettings.value.url,
                    apiKey: apiSettings.value.key,
                    model: apiSettings.value.model,
                    systemPrompt: buildWorldBookSystemPrompt(translationConfig.value, buildTranslationPrompt),
                    userContent: taggedText,
                    tagMap: fieldMap,
                    onProgress: (progressData) => {
                        if (progressData.completed) {
                            bookStreamResults.value.push({
                                tag: progressData.tag,
                                result: progressData.result,
                                info: progressData.info,
                                batchIndex,
                                selected: true
                            });
                        }
                    }
                });

                if (result.success) {
                    const batchResults = collectStreamBatchResults({
                        fieldMap,
                        streamResults: result.results,
                    });
                    bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
                } else {
                    throw new Error(result.error || '重试失败');
                }
            } else {
                const retryAbortController = new AbortController();
                bookRequestAbortControllers.value.push(retryAbortController);
                const response = await fetch(apiSettings.value.url + '/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiSettings.value.key}`
                    },
                    signal: retryAbortController.signal,
                    body: JSON.stringify({
                        model: apiSettings.value.model,
                        messages: [
                            {
                                role: 'system',
                                content: buildWorldBookSystemPrompt(translationConfig.value, buildTranslationPrompt)
                            },
                            { role: 'user', content: taggedText }
                        ],
                        temperature: 0.3
                    })
                });

                bookRequestAbortControllers.value = bookRequestAbortControllers.value.filter(controller => controller !== retryAbortController);

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || '请求失败');
                }

                const data = await response.json();
                const translatedText = data.choices[0].message.content;
                const { batchResults } = parseWorldBookBatchResults({
                    fieldMap,
                    translatedText,
                });

                if (Object.keys(batchResults).length > 0) {
                    bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
                } else {
                    throw new Error('未获取到有效结果');
                }
            }
        } catch (error) {
            console.error(`❌ 批次 ${batchIndex + 1} 重试失败:`, error);
            bookBatchState.setBatchStatus(batchIndex, 'error', { error: error.message });
            bookTranslationErrors.value.push({
                field: `批次 ${batchIndex + 1}`,
                message: error.message
            });
        }
    };

    const retryAllFailedBookBatches = async () => {
        const failedBatchIndices = bookBatchState.getFailedBatches();
        const failedCount = failedBatchIndices.length;

        if (failedCount === 0) {
            return;
        }

        const modalSettings = bookBatchTranslateModalRef.value;
        const useConcurrent = modalSettings?.useConcurrentTranslation ?? false;

        if (useConcurrent && failedCount > 1) {
            const retryPromises = failedBatchIndices.map(index => retryBookBatch(index));
            await Promise.allSettled(retryPromises);
        } else {
            for (const index of failedBatchIndices) {
                await retryBookBatch(index);
            }
        }
    };

    return {
        selectAllBookEntries,
        deselectAllBookEntries,
        cancelBookTranslation,
        closeBookBatchTranslateModal,
        retryBookBatch,
        retryAllFailedBookBatches,
    };
}
