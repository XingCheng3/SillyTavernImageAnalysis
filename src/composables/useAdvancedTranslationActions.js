import { getAdvancedFieldDisplayName } from '@/utils/translationDisplayNames';

export function useAdvancedTranslationActions({
    editableData,
    advancedTranslateFields,
    selectedAlternateGreetings,
    hasAdvancedSelectedFields,
    apiSettings,
    translationConfig,
    buildTranslationPrompt,
    startAdvancedTimeTracking,
    stopTimeTracking,
    getPrepareAdvancedTranslationCompare,
    getFriendlyErrorMessage,
    mapErrorCode,
    openErrorModal,
    showOperationNotice,
    showAdvancedBatchTranslateModal,
    isAdvancedTranslating,
    advancedTranslatedCount,
    advancedTotalToTranslate,
    advancedTranslationErrors,
    isAdvancedTranslationComplete,
    cancelAdvancedTranslationFlag,
    advancedTranslationAbortController,
    isAdvancedTranslationError,
    canRetryAdvancedTranslation,
}) {
    const selectAllAlternateGreetings = () => {
        const count = Array.isArray(editableData.value?.alternate_greetings) ? editableData.value.alternate_greetings.length : 0;
        selectedAlternateGreetings.value = new Array(count).fill(true);
    };

    const deselectAllAlternateGreetings = () => {
        const count = Array.isArray(editableData.value?.alternate_greetings) ? editableData.value.alternate_greetings.length : 0;
        selectedAlternateGreetings.value = new Array(count).fill(false);
    };

    const startAdvancedBatchTranslation = async () => {
        console.log('开始高级设置批量翻译');

        if (!hasAdvancedSelectedFields.value) {
            showOperationNotice({
                type: 'warning',
                title: '请选择高级设置字段',
                message: '至少选择一个高级设置字段后才能开始翻译。',
            });
            return;
        }

        advancedTranslatedCount.value = 0;
        advancedTranslationErrors.value = [];
        isAdvancedTranslating.value = true;
        isAdvancedTranslationComplete.value = false;
        isAdvancedTranslationError.value = false;
        canRetryAdvancedTranslation.value = false;
        cancelAdvancedTranslationFlag.value = false;

        startAdvancedTimeTracking();

        try {
            const fieldsToTranslate = [];
            let totalFields = 0;

            Object.entries(advancedTranslateFields).forEach(([field, selected]) => {
                if (selected) {
                    if (field === 'alternate_greetings') {
                        if (Array.isArray(editableData.value.alternate_greetings) && editableData.value.alternate_greetings.length > 0) {
                            editableData.value.alternate_greetings.forEach((greeting, index) => {
                                if (selectedAlternateGreetings.value[index] && greeting && greeting.trim()) {
                                    fieldsToTranslate.push({
                                        type: 'alternate_greeting',
                                        field: 'alternate_greetings',
                                        index,
                                        content: greeting.trim()
                                    });
                                    totalFields++;
                                }
                            });
                        }
                    } else if (editableData.value[field] && editableData.value[field].trim()) {
                        fieldsToTranslate.push({
                            type: 'normal',
                            field,
                            content: editableData.value[field].trim()
                        });
                        totalFields++;
                    }
                }
            });

            if (fieldsToTranslate.length === 0) {
                showOperationNotice({
                    type: 'warning',
                    title: '没有可翻译内容',
                    message: '当前所选高级设置字段没有可用文本。',
                });
                isAdvancedTranslating.value = false;
                stopTimeTracking();
                return;
            }

            advancedTotalToTranslate.value = totalFields;

            let translationText = '';
            let tagIndex = 1;
            const fieldTagMap = {};

            fieldsToTranslate.forEach((item) => {
                const tag = `TXT${tagIndex}`;
                fieldTagMap[tag] = item;
                translationText += `<${tag}>${item.content}</${tag}>\n\n`;
                tagIndex++;
            });

            advancedTranslationAbortController.value = new AbortController();
            const response = await fetch(apiSettings.value.url + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.value.key}`
                },
                signal: advancedTranslationAbortController.value.signal,
                body: JSON.stringify({
                    model: apiSettings.value.model,
                    messages: [
                        {
                            role: 'system',
                            content: buildTranslationPrompt(translationConfig.value, true)
                        },
                        { role: 'user', content: translationText }
                    ],
                    temperature: 0.3
                })
            });
            advancedTranslationAbortController.value = null;

            if (!response.ok) {
                const errData = await response.json();
                const errorInfo = {
                    status: response.status,
                    statusText: response.statusText,
                    ...errData.error
                };
                throw new Error(JSON.stringify(errorInfo, null, 2));
            }

            const data = await response.json();
            if (!data.choices || data.choices.length === 0) {
                throw new Error('API未返回任何结果');
            }

            const translatedText = data.choices[0].message.content;

            if (cancelAdvancedTranslationFlag.value) {
                return;
            }

            const results = {};
            const missingTags = [];
            const expectedTags = Object.keys(fieldTagMap);

            Object.entries(fieldTagMap).forEach(([tag, item]) => {
                const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
                const match = translatedText.match(regex);

                if (match && match[1] && match[1].trim()) {
                    if (item.type === 'alternate_greeting') {
                        if (!results.alternate_greetings) {
                            results.alternate_greetings = [];
                        }
                        results.alternate_greetings[item.index] = match[1].trim();
                    } else {
                        results[item.field] = match[1].trim();
                    }
                    advancedTranslatedCount.value++;
                } else {
                    const fieldDisplayName = item.type === 'alternate_greeting'
                        ? `备选问候语 ${item.index + 1}`
                        : getAdvancedFieldDisplayName(item.field);
                    missingTags.push({
                        field: fieldDisplayName,
                        tag,
                        item,
                    });
                }
            });

            const resultKeys = Object.keys(results);
            const allMissing = missingTags.length === expectedTags.length;
            const noUseful = resultKeys.length === 0 || (
                resultKeys.length === 1 &&
                resultKeys[0] === 'alternate_greetings' &&
                (!Array.isArray(results.alternate_greetings) || results.alternate_greetings.filter(Boolean).length === 0)
            );

            if (allMissing || noUseful) {
                const badFormatMsg = '返回结果未遵循预期返回格式，请重试';
                openErrorModal({
                    title: '高级设置翻译失败',
                    code: 'BAD_FORMAT',
                    message: badFormatMsg,
                    details: { expectedTags, translatedText: translatedText?.slice(0, 800) }
                });
                advancedTranslationErrors.value.push({ field: '高级设置批量翻译', message: badFormatMsg });
                isAdvancedTranslationError.value = true;
                canRetryAdvancedTranslation.value = true;
                isAdvancedTranslating.value = false;
                stopTimeTracking();
                return;
            }

            if (missingTags.length > 0) {
                missingTags.forEach(({ field, tag, item }) => {
                    advancedTranslationErrors.value.push({
                        field,
                        message: `标签 ${tag} 在返回结果中丢失`,
                        details: item,
                    });
                });
            }

            const prepareAdvancedTranslationCompare = getPrepareAdvancedTranslationCompare?.();
            if (typeof prepareAdvancedTranslationCompare !== 'function') {
                throw new Error('高级翻译结果对比处理器未初始化');
            }
            prepareAdvancedTranslationCompare(results, missingTags);
        } catch (err) {
            if (err?.name === 'AbortError') {
                return;
            }

            let errorMessage = err.message;
            let errorDetails = null;

            try {
                if (err.message.includes('{')) {
                    const errorObj = JSON.parse(err.message);
                    if (errorObj.error) {
                        errorDetails = errorObj.error;
                        errorMessage = errorObj.error.message || err.message;
                    } else if (errorObj.code || errorObj.type) {
                        errorDetails = errorObj;
                        errorMessage = errorObj.message || err.message;
                    }
                }
            } catch (_parseErr) {
                console.log('非JSON格式错误，使用原始信息');
            }

            const friendlyMessage = getFriendlyErrorMessage(errorDetails || { message: errorMessage });
            openErrorModal({
                title: '高级设置翻译失败',
                code: mapErrorCode(errorDetails || { message: errorMessage }),
                message: friendlyMessage,
                status: errorDetails?.status,
                statusText: errorDetails?.statusText,
                details: errorDetails || { message: errorMessage }
            });

            advancedTranslationErrors.value.push({
                field: '高级设置批量翻译',
                message: errorMessage,
                details: errorDetails
            });

            isAdvancedTranslationError.value = true;
            canRetryAdvancedTranslation.value = true;
            isAdvancedTranslating.value = false;
            stopTimeTracking();
            return;
        }

        isAdvancedTranslating.value = false;
        isAdvancedTranslationComplete.value = true;
        stopTimeTracking();
    };

    const cancelAdvancedTranslation = () => {
        cancelAdvancedTranslationFlag.value = true;
        advancedTranslationAbortController.value?.abort();
        advancedTranslationAbortController.value = null;
        isAdvancedTranslating.value = false;
        isAdvancedTranslationComplete.value = false;
        stopTimeTracking();
        showOperationNotice({ type: 'info', title: '已取消高级设置翻译', message: '当前高级设置翻译已停止。' });
    };

    const closeAdvancedBatchTranslateModal = () => {
        showAdvancedBatchTranslateModal.value = false;
        isAdvancedTranslating.value = false;
        isAdvancedTranslationComplete.value = false;
        isAdvancedTranslationError.value = false;
        canRetryAdvancedTranslation.value = false;
        advancedTranslationErrors.value = [];
        cancelAdvancedTranslationFlag.value = false;
        advancedTranslationAbortController.value = null;
        selectedAlternateGreetings.value = [];
        advancedTranslatedCount.value = 0;
        advancedTotalToTranslate.value = 0;
        stopTimeTracking();
    };

    return {
        selectAllAlternateGreetings,
        deselectAllAlternateGreetings,
        startAdvancedBatchTranslation,
        cancelAdvancedTranslation,
        closeAdvancedBatchTranslateModal,
    };
}
