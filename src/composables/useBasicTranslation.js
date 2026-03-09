import { reactive, ref } from 'vue';

export function useBasicTranslation({
    editableData,
    apiSettings,
    translationConfig,
    checkAndPromptApiConfig,
    startTimeTracking,
    stopTimeTracking,
    prepareTranslationCompare,
    buildTranslationPrompt,
    getFriendlyErrorMessage,
    mapErrorCode,
    openErrorModal,
    showOperationNotice,
}) {
    const showBatchTranslateModal = ref(false);
    const selectedFields = reactive({
        name: true,
        description: true,
        personality: true,
        scenario: true,
        first_message: true,
        message_example: true
    });
    const isTranslating = ref(false);
    const currentTranslatingField = ref('');
    const translatedCount = ref(0);
    const totalFieldsToTranslate = ref(0);
    const translationErrors = ref([]);
    const isTranslationComplete = ref(false);
    const cancelTranslationFlag = ref(false);
    const basicTranslationAbortController = ref(null);
    const isTranslationError = ref(false);
    const canRetryTranslation = ref(false);

    const selectAllFields = () => {
        selectedFields.name = true;
        selectedFields.description = true;
        selectedFields.personality = true;
        selectedFields.scenario = true;
        selectedFields.first_message = true;
        selectedFields.message_example = true;
    };

    const deselectAllFields = () => {
        selectedFields.name = false;
        selectedFields.description = false;
        selectedFields.personality = false;
        selectedFields.scenario = false;
        selectedFields.first_message = false;
        selectedFields.message_example = false;
    };

    const fieldNameMap = {
        name: '角色名称',
        description: '描述',
        personality: '性格',
        scenario: '场景',
        first_message: '首次问候',
        message_example: '示例对话'
    };

    const startBatchTranslation = async () => {
        if (!checkAndPromptApiConfig()) {
            return;
        }

        isTranslating.value = true;
        currentTranslatingField.value = '准备翻译...';
        translatedCount.value = 0;
        totalFieldsToTranslate.value = 0;
        translationErrors.value = [];
        isTranslationComplete.value = false;
        isTranslationError.value = false;
        canRetryTranslation.value = false;
        cancelTranslationFlag.value = false;

        startTimeTracking();

        const fieldsToTranslate = [];
        let totalItemsToTranslate = 0;

        Object.keys(selectedFields).forEach(field => {
            if (selectedFields[field] && editableData.value[field] && editableData.value[field].trim()) {
                fieldsToTranslate.push({
                    type: 'normal',
                    field,
                    content: editableData.value[field].trim()
                });
                totalItemsToTranslate++;
            }
        });

        if (fieldsToTranslate.length === 0) {
            showOperationNotice({
                type: 'warning',
                title: '没有可翻译内容',
                message: '请先勾选并填写有文本内容的基础字段。',
            });
            isTranslating.value = false;
            return;
        }

        totalFieldsToTranslate.value = totalItemsToTranslate;

        try {
            let taggedText = '';
            const fieldMap = {};

            fieldsToTranslate.forEach((item, index) => {
                const tag = `TXT${index + 1}`;
                taggedText += `<${tag}>${item.content}</${tag}>\n\n`;
                fieldMap[tag] = item;
            });

            currentTranslatingField.value = '正在翻译所有字段...';

            basicTranslationAbortController.value = new AbortController();
            const response = await fetch(apiSettings.value.url + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.value.key}`
                },
                signal: basicTranslationAbortController.value.signal,
                body: JSON.stringify({
                    model: apiSettings.value.model,
                    messages: [
                        {
                            role: 'system',
                            content: buildTranslationPrompt(translationConfig.value, true)
                        },
                        { role: 'user', content: taggedText }
                    ],
                    temperature: 0.3
                })
            });
            basicTranslationAbortController.value = null;

            if (!response.ok) {
                const errData = await response.json();
                const errorInfo = {
                    status: response.status,
                    statusText: response.statusText,
                    ...errData.error
                };
                const errorMessage = JSON.stringify(errorInfo, null, 2);
                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (!data.choices || data.choices.length === 0) {
                throw new Error('API未返回任何结果');
            }

            const translatedText = data.choices[0].message.content;
            const translationResults = {};
            const missingTags = [];
            const expectedTags = Object.keys(fieldMap);

            for (const [tag, item] of Object.entries(fieldMap)) {
                const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
                const match = translatedText.match(regex);

                if (match && match[1]) {
                    translationResults[item.field] = match[1].trim();
                    translatedCount.value++;
                } else {
                    const fieldDisplayName = fieldNameMap[item.field] || item.field;
                    missingTags.push({
                        field: fieldDisplayName,
                        tag
                    });
                }
            }

            if (Object.keys(translationResults).length === 0 || missingTags.length === expectedTags.length) {
                const badFormatMsg = '返回结果未遵循预期返回格式，请重试';
                openErrorModal({
                    title: '翻译失败',
                    code: 'BAD_FORMAT',
                    message: badFormatMsg,
                    details: { expectedTags, translatedText: translatedText?.slice(0, 800) }
                });
                translationErrors.value.push({ field: '批量翻译', message: badFormatMsg });
                isTranslationError.value = true;
                canRetryTranslation.value = true;
                isTranslating.value = false;
                stopTimeTracking();
                return;
            }

            prepareTranslationCompare(translationResults, missingTags, 'basic');

            if (missingTags.length > 0) {
                missingTags.forEach(({ field, tag }) => {
                    translationErrors.value.push({
                        field,
                        message: `标签 ${tag} 在返回结果中丢失`
                    });
                });
            }
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
            } catch (_parseErr) {}

            if (!errorDetails && err && typeof err === 'object') {
                try {
                    const parsed = JSON.parse(err.message);
                    if (parsed && (parsed.status || parsed.statusText)) {
                        errorDetails = { ...parsed, ...(parsed.error || {}) };
                    }
                } catch (_) {}
            }

            const friendlyMessage = getFriendlyErrorMessage(errorDetails || { message: errorMessage });
            openErrorModal({
                title: '翻译失败',
                code: mapErrorCode(errorDetails || { message: errorMessage }),
                message: friendlyMessage,
                status: errorDetails?.status,
                statusText: errorDetails?.statusText,
                details: errorDetails || { message: errorMessage }
            });

            translationErrors.value.push({
                field: '批量翻译',
                message: errorMessage,
                details: errorDetails
            });

            isTranslationError.value = true;
            canRetryTranslation.value = true;
            isTranslating.value = false;
            stopTimeTracking();
            return;
        }

        isTranslating.value = false;
        isTranslationComplete.value = true;
        stopTimeTracking();
    };

    const cancelTranslation = () => {
        cancelTranslationFlag.value = true;
        basicTranslationAbortController.value?.abort();
        basicTranslationAbortController.value = null;
        isTranslating.value = false;
        isTranslationComplete.value = false;
        showOperationNotice({ type: 'info', title: '已取消基础翻译', message: '当前基础信息翻译已停止。' });
    };

    const closeBatchTranslateModal = () => {
        showBatchTranslateModal.value = false;
        isTranslating.value = false;
        isTranslationComplete.value = false;
        isTranslationError.value = false;
        canRetryTranslation.value = false;
        translationErrors.value = [];
        cancelTranslationFlag.value = false;
        stopTimeTracking();
    };

    return {
        showBatchTranslateModal,
        selectedFields,
        isTranslating,
        currentTranslatingField,
        translatedCount,
        totalFieldsToTranslate,
        translationErrors,
        isTranslationComplete,
        cancelTranslationFlag,
        basicTranslationAbortController,
        isTranslationError,
        canRetryTranslation,
        selectAllFields,
        deselectAllFields,
        startBatchTranslation,
        cancelTranslation,
        closeBatchTranslateModal,
    };
}
