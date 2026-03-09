import { ref } from 'vue';
import { getAdvancedFieldDisplayName, getFieldDisplayName } from '@/utils/translationDisplayNames';

export function useTranslationCompare({
    editableData,
    apiSettings,
    pushSnapshot,
    showOperationNotice,
    openErrorModal,
    stopTimeTracking,
    showBatchTranslateModal,
    showBookBatchTranslateModal,
    showAdvancedBatchTranslateModal,
    isTranslating,
    isTranslationComplete,
    isBookTranslating,
    isBookTranslationComplete,
    isAdvancedTranslating,
    isAdvancedTranslationComplete,
    formattedStartTime,
    translationDuration,
    formattedBookStartTime,
    bookTranslationDuration,
    formattedAdvancedStartTime,
    advancedTranslationDuration,
}) {
    const showCompareModal = ref(false);
    const translationCompareData = ref([]);
    const translationResults = ref(null);
    const finalTranslationInfo = ref({
        startTime: '',
        duration: '',
        modelName: ''
    });

    const prepareTranslationCompare = (results, missingTags, type) => {
        const compareData = [];

        if (type === 'basic') {
            for (const [field, translation] of Object.entries(results)) {
                const original = editableData.value[field] || '';
                compareData.push({
                    field,
                    original,
                    translated: translation,
                    type: 'basic',
                    selected: true,
                    displayName: getFieldDisplayName(field)
                });
            }

            missingTags.forEach(({ field }) => {
                const original = editableData.value[field] || '';
                compareData.push({
                    field,
                    original,
                    translated: '',
                    type: 'basic',
                    selected: false,
                    failed: true,
                    displayName: getFieldDisplayName(field)
                });
            });
        }

        translationResults.value = results;
        translationCompareData.value = compareData;
        finalTranslationInfo.value = {
            startTime: formattedStartTime.value,
            duration: translationDuration.value,
            modelName: apiSettings.value.model
        };
        showCompareModal.value = true;
        showBatchTranslateModal.value = false;
        isTranslating.value = false;
        isTranslationComplete.value = true;
        stopTimeTracking();
    };

    const applySelectedTranslations = (selectedItems) => {
        try {
            pushSnapshot('应用基础翻译');
            selectedItems.forEach(item => {
                if (!item.failed && item.translated) {
                    editableData.value[item.field] = item.translated;
                }
            });

            showCompareModal.value = false;
            showOperationNotice({
                type: 'success',
                title: '基础翻译已应用',
                message: `已应用 ${selectedItems.length} 个基础字段的翻译结果。`,
            });
        } catch (error) {
            showOperationNotice({
                type: 'error',
                title: '应用基础翻译失败',
                message: error.message,
                duration: 7000,
            });
        }
    };

    const previewTranslationChanges = (selectedItems) => {
        let message = '将要应用以下翻译更改：\n\n';

        selectedItems.forEach(item => {
            const fieldName = getFieldDisplayName(item.field);
            message += `📝 ${fieldName}:\n`;
            message += `   原文: ${item.original.substring(0, 50)}${item.original.length > 50 ? '...' : ''}\n`;
            message += `   译文: ${item.translated.substring(0, 50)}${item.translated.length > 50 ? '...' : ''}\n\n`;
        });

        openErrorModal({
            title: '翻译变更预览',
            message: '以下是基础字段翻译即将应用的内容。',
            details: message,
        });
    };

    const prepareBookTranslationCompare = (results, missingTags) => {
        const compareData = [];

        for (const [entryIndex, fields] of Object.entries(results)) {
            const entry = editableData.value.book_entries[parseInt(entryIndex)];
            const entryName = entry.name || `条目 ${parseInt(entryIndex) + 1}`;

            Object.entries(fields).forEach(([field, translation]) => {
                let original = '';
                let fieldKey = `${entryIndex}-${field}`;

                if (field === 'name') {
                    original = entry.name || '';
                } else if (field === 'keywords') {
                    original = entry.keysText || '';
                } else if (field === 'content') {
                    original = entry.content || '';
                }

                compareData.push({
                    field: fieldKey,
                    entryIndex: parseInt(entryIndex),
                    entryName,
                    fieldType: field,
                    original,
                    translated: translation,
                    type: 'worldbook',
                    selected: true,
                    displayName: `${entryName} - ${getFieldDisplayName(field)}`
                });
            });
        }

        missingTags.forEach(({ field }) => {
            const parts = field.split(' - ');
            if (parts.length === 2) {
                const entryName = parts[0];
                const fieldName = parts[1];

                compareData.push({
                    field: `failed-${field}`,
                    entryName,
                    fieldType: fieldName,
                    original: '',
                    translated: '',
                    type: 'worldbook',
                    selected: false,
                    failed: true
                });
            }
        });

        translationResults.value = results;
        translationCompareData.value = compareData;
        finalTranslationInfo.value = {
            startTime: formattedBookStartTime.value,
            duration: bookTranslationDuration.value,
            modelName: apiSettings.value.model
        };
        showCompareModal.value = true;
        showBookBatchTranslateModal.value = false;
        isBookTranslating.value = false;
        isBookTranslationComplete.value = true;
        stopTimeTracking();
    };

    const applySelectedBookTranslations = (selectedItems) => {
        try {
            pushSnapshot('应用世界书翻译');
            selectedItems.forEach(item => {
                if (!item.failed && item.translated && item.entryIndex !== undefined) {
                    const entry = editableData.value.book_entries[item.entryIndex];

                    if (item.fieldType === 'name') {
                        entry.name = item.translated;
                    } else if (item.fieldType === 'keywords') {
                        entry.keysText = item.translated;
                        entry.keys = item.translated.split(',').map(k => k.trim()).filter(Boolean);
                    } else if (item.fieldType === 'content') {
                        entry.content = item.translated;
                    }
                }
            });

            showCompareModal.value = false;
            showOperationNotice({
                type: 'success',
                title: '世界书翻译已应用',
                message: `已应用 ${selectedItems.length} 项世界书修改。`,
            });
        } catch (error) {
            showOperationNotice({
                type: 'error',
                title: '应用世界书翻译失败',
                message: error.message,
                duration: 7000,
            });
        }
    };

    const prepareAdvancedTranslationCompare = (results, missingTags) => {
        const compareData = [];

        Object.entries(results).forEach(([field, translation]) => {
            if (field === 'alternate_greetings' && Array.isArray(translation)) {
                translation.forEach((greetingTranslation, index) => {
                    if (greetingTranslation) {
                        const original = editableData.value.alternate_greetings?.[index] || '';
                        compareData.push({
                            field: 'alternate_greetings',
                            index,
                            original,
                            translated: greetingTranslation,
                            type: 'advanced',
                            selected: true,
                            displayName: `备选问候语 ${index + 1}`
                        });
                    }
                });
            } else {
                const original = editableData.value[field] || '';
                compareData.push({
                    field,
                    original,
                    translated: translation,
                    type: 'advanced',
                    selected: true,
                    displayName: getAdvancedFieldDisplayName(field)
                });
            }
        });

        missingTags.forEach(({ field, item }) => {
            if (item && item.type === 'alternate_greeting') {
                const original = editableData.value.alternate_greetings?.[item.index] || '';
                compareData.push({
                    field: 'alternate_greetings',
                    index: item.index,
                    original,
                    translated: '',
                    type: 'advanced',
                    selected: false,
                    failed: true,
                    displayName: `备选问候语 ${item.index + 1}`,
                    details: item
                });
            } else {
                const original = editableData.value[field] || '';
                compareData.push({
                    field,
                    original,
                    translated: '',
                    type: 'advanced',
                    selected: false,
                    failed: true,
                    displayName: getAdvancedFieldDisplayName(field),
                    details: item
                });
            }
        });

        translationResults.value = results;
        translationCompareData.value = compareData;
        finalTranslationInfo.value = {
            startTime: formattedAdvancedStartTime.value,
            duration: advancedTranslationDuration.value,
            modelName: apiSettings.value.model
        };
        showCompareModal.value = true;
        showAdvancedBatchTranslateModal.value = false;
        isAdvancedTranslating.value = false;
        isAdvancedTranslationComplete.value = true;
        stopTimeTracking();
    };

    const applySelectedAdvancedTranslations = (selectedItems) => {
        try {
            pushSnapshot('应用高级设置翻译');
            selectedItems.forEach(item => {
                if (!item.failed && item.translated) {
                    if (item.field === 'alternate_greetings' && item.index !== undefined) {
                        if (!editableData.value.alternate_greetings) {
                            editableData.value.alternate_greetings = [];
                        }
                        editableData.value.alternate_greetings[item.index] = item.translated;
                    } else {
                        editableData.value[item.field] = item.translated;
                    }
                }
            });

            showCompareModal.value = false;
            showOperationNotice({
                type: 'success',
                title: '高级设置翻译已应用',
                message: `已应用 ${selectedItems.length} 个高级字段的翻译结果。`,
            });
        } catch (error) {
            showOperationNotice({
                type: 'error',
                title: '应用高级设置翻译失败',
                message: error.message,
                duration: 7000,
            });
        }
    };

    const handleCompareApply = (selectedItems) => {
        const currentType = translationCompareData.value[0]?.type;

        if (currentType === 'basic') {
            applySelectedTranslations(selectedItems);
        } else if (currentType === 'worldbook') {
            applySelectedBookTranslations(selectedItems);
        } else if (currentType === 'advanced') {
            applySelectedAdvancedTranslations(selectedItems);
        }
    };

    const handleComparePreview = (selectedItems) => {
        const currentType = translationCompareData.value[0]?.type;

        if (currentType === 'basic') {
            previewTranslationChanges(selectedItems);
        } else if (currentType === 'worldbook') {
            let message = '将要应用以下翻译更改：\n\n';

            selectedItems.forEach(item => {
                message += `📚 ${item.entryName} - ${getFieldDisplayName(item.fieldType)}:\n`;
                message += `   原文: ${item.original.substring(0, 50)}${item.original.length > 50 ? '...' : ''}\n`;
                message += `   译文: ${item.translated.substring(0, 50)}${item.translated.length > 50 ? '...' : ''}\n\n`;
            });

            openErrorModal({
                title: '翻译变更预览',
                message: '以下是世界书翻译即将应用的内容。',
                details: message,
            });
        } else if (currentType === 'advanced') {
            let message = '将要应用以下翻译更改：\n\n';

            selectedItems.forEach(item => {
                message += `⚙️ ${item.displayName}:\n`;
                message += `   原文: ${item.original.substring(0, 50)}${item.original.length > 50 ? '...' : ''}\n`;
                message += `   译文: ${item.translated.substring(0, 50)}${item.translated.length > 50 ? '...' : ''}\n\n`;
            });

            openErrorModal({
                title: '翻译变更预览',
                message: '以下是高级设置翻译即将应用的内容。',
                details: message,
            });
        }
    };

    const handleCompareClose = () => {
        showCompareModal.value = false;
        translationCompareData.value = [];
        translationResults.value = null;
        finalTranslationInfo.value = {
            startTime: '',
            duration: '',
            modelName: ''
        };
    };

    return {
        showCompareModal,
        translationCompareData,
        translationResults,
        finalTranslationInfo,
        prepareTranslationCompare,
        prepareBookTranslationCompare,
        prepareAdvancedTranslationCompare,
        handleCompareApply,
        handleComparePreview,
        handleCompareClose,
    };
}
