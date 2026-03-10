import { getBookFieldsToTranslate } from '@/utils/worldBookTranslationWorkflow';
import { executeWorldBookBatch } from '@/utils/worldBookBatchExecutor';

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
        bookTranslationMissingTags.value = bookTranslationMissingTags.value.filter(
            item => !item.field.startsWith(`批次${batchIndex + 1} -`) && !item.field.startsWith(`批次 ${batchIndex + 1}`)
        );
        bookStreamResults.value = bookStreamResults.value.filter(item => item.batchIndex !== batchIndex);

        const fieldsToTranslate = getBookFieldsToTranslate(bookTranslateFields);
        bookBatchState.setBatchStatus(batchIndex, 'translating');

        const result = await executeWorldBookBatch({
            batchIndex,
            batchIndices,
            entries: editableData.value.book_entries,
            editableData: editableData.value,
            fieldsToTranslate,
            useStream,
            apiSettings: apiSettings.value,
            translationConfig: translationConfig.value,
            buildTranslationPrompt,
            buildBookTranslationTags,
            bookStreamTranslate,
            bookRequestAbortControllers,
            cancelBookTranslationFlag,
            onStreamProgress: (progressData) => {
                if (progressData.completed) {
                    bookStreamResults.value.push({
                        tag: progressData.tag,
                        result: progressData.result,
                        info: progressData.info,
                        batchIndex,
                        selected: true,
                    });
                }
            },
        });

        if (result.status === 'cancelled') {
            bookBatchState.setBatchStatus(batchIndex, 'error', { error: '用户取消' });
            return;
        }

        if (result.status === 'skipped') {
            bookBatchState.setBatchStatus(batchIndex, 'success', { results: {} });
            return;
        }

        if (result.status === 'error') {
            console.error(`❌ 批次 ${batchIndex + 1} 重试失败:`, result.error);
            bookBatchState.setBatchStatus(batchIndex, 'error', { error: result.error });
            bookTranslationErrors.value.push({
                field: `批次 ${batchIndex + 1}`,
                message: result.error,
            });
            return;
        }

        const { batchResults, expectedTags = [], missingTags = [] } = result;
        if (!useStream && (Object.keys(batchResults).length === 0 || missingTags.length === expectedTags.length)) {
            const errorMessage = `批次 ${batchIndex + 1} 返回结果未遵循预期返回格式`;
            bookBatchState.setBatchStatus(batchIndex, 'error', { error: errorMessage });
            bookTranslationErrors.value.push({
                field: `批次 ${batchIndex + 1}`,
                message: errorMessage,
            });
            return;
        }

        bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
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
