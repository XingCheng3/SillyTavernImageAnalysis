import { ref, reactive } from 'vue';

export function useGlobalReplace({ editableData, pushSnapshot, showOperationNotice }) {
    const showGlobalReplaceModal = ref(false);
    const replaceForm = reactive({
        originalText: '',
        newText: ''
    });
    const occurrenceCount = ref(0);
    const occurrenceDetails = ref([]);

    const resetGlobalReplaceState = () => {
        replaceForm.originalText = '';
        replaceForm.newText = '';
        occurrenceCount.value = 0;
        occurrenceDetails.value = [];
    };

    const checkOccurrences = () => {
        if (!replaceForm.originalText || !editableData.value) {
            occurrenceCount.value = 0;
            occurrenceDetails.value = [];
            return;
        }

        const searchText = replaceForm.originalText;
        let totalCount = 0;
        const details = [];

        const fieldsToSearch = [
            { key: 'name', name: '角色名称' },
            { key: 'description', name: '描述' },
            { key: 'personality', name: '性格' },
            { key: 'scenario', name: '场景' },
            { key: 'first_message', name: '首次问候' },
            { key: 'message_example', name: '示例对话' },
            { key: 'system_prompt', name: '系统提示词' },
            { key: 'post_history_instructions', name: '历史后指令' },
            { key: 'creator_notes', name: '作者备注' }
        ];

        fieldsToSearch.forEach(field => {
            const fieldValue = editableData.value[field.key];
            if (fieldValue && typeof fieldValue === 'string') {
                const matches = fieldValue.split(searchText).length - 1;
                if (matches > 0) {
                    totalCount += matches;

                    const index = fieldValue.indexOf(searchText);
                    const start = Math.max(0, index - 20);
                    const end = Math.min(fieldValue.length, index + searchText.length + 20);
                    const preview = (start > 0 ? '...' : '') +
                        fieldValue.substring(start, end) +
                        (end < fieldValue.length ? '...' : '');

                    details.push({
                        field: field.key,
                        fieldName: field.name,
                        count: matches,
                        preview
                    });
                }
            }
        });

        if (Array.isArray(editableData.value.alternate_greetings)) {
            editableData.value.alternate_greetings.forEach((greeting, index) => {
                if (greeting && typeof greeting === 'string') {
                    const matches = greeting.split(searchText).length - 1;
                    if (matches > 0) {
                        totalCount += matches;

                        const greetingIndex = greeting.indexOf(searchText);
                        const start = Math.max(0, greetingIndex - 20);
                        const end = Math.min(greeting.length, greetingIndex + searchText.length + 20);
                        const preview = (start > 0 ? '...' : '') +
                            greeting.substring(start, end) +
                            (end < greeting.length ? '...' : '');

                        details.push({
                            field: `alternate_greetings_${index}`,
                            fieldName: `备选问候语 ${index + 1}`,
                            count: matches,
                            preview
                        });
                    }
                }
            });
        }

        if (Array.isArray(editableData.value.book_entries)) {
            editableData.value.book_entries.forEach((entry, index) => {
                if (entry.name && typeof entry.name === 'string') {
                    const matches = entry.name.split(searchText).length - 1;
                    if (matches > 0) {
                        totalCount += matches;
                        details.push({
                            field: `book_entry_${index}_name`,
                            fieldName: `世界书条目 ${index + 1} - 名称`,
                            count: matches,
                            preview: entry.name
                        });
                    }
                }

                if (entry.content && typeof entry.content === 'string') {
                    const matches = entry.content.split(searchText).length - 1;
                    if (matches > 0) {
                        totalCount += matches;

                        const contentIndex = entry.content.indexOf(searchText);
                        const start = Math.max(0, contentIndex - 20);
                        const end = Math.min(entry.content.length, contentIndex + searchText.length + 20);
                        const preview = (start > 0 ? '...' : '') +
                            entry.content.substring(start, end) +
                            (end < entry.content.length ? '...' : '');

                        details.push({
                            field: `book_entry_${index}_content`,
                            fieldName: `世界书条目 ${index + 1} - 内容`,
                            count: matches,
                            preview
                        });
                    }
                }

                if (entry.keysText && typeof entry.keysText === 'string') {
                    const matches = entry.keysText.split(searchText).length - 1;
                    if (matches > 0) {
                        totalCount += matches;
                        details.push({
                            field: `book_entry_${index}_keys`,
                            fieldName: `世界书条目 ${index + 1} - 关键词`,
                            count: matches,
                            preview: entry.keysText
                        });
                    }
                }
            });
        }

        occurrenceCount.value = totalCount;
        occurrenceDetails.value = details;
    };

    const executeGlobalReplace = () => {
        if (!replaceForm.originalText || !editableData.value) {
            showOperationNotice({ type: 'warning', title: '替换条件不完整', message: '请先填写要查找的原文本。' });
            return;
        }

        pushSnapshot('执行全局替换');
        const searchText = replaceForm.originalText;
        const newText = replaceForm.newText ?? '';
        let totalReplaced = 0;

        const fieldsToReplace = [
            'name', 'description', 'personality', 'scenario',
            'first_message', 'message_example', 'system_prompt',
            'post_history_instructions', 'creator_notes'
        ];

        fieldsToReplace.forEach(field => {
            const fieldValue = editableData.value[field];
            if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes(searchText)) {
                const beforeCount = fieldValue.split(searchText).length - 1;
                editableData.value[field] = fieldValue.replaceAll(searchText, newText);
                totalReplaced += beforeCount;
            }
        });

        if (Array.isArray(editableData.value.alternate_greetings)) {
            editableData.value.alternate_greetings.forEach((greeting, index) => {
                if (greeting && typeof greeting === 'string' && greeting.includes(searchText)) {
                    const beforeCount = greeting.split(searchText).length - 1;
                    editableData.value.alternate_greetings[index] = greeting.replaceAll(searchText, newText);
                    totalReplaced += beforeCount;
                }
            });
        }

        if (Array.isArray(editableData.value.book_entries)) {
            editableData.value.book_entries.forEach((entry) => {
                if (entry.name && typeof entry.name === 'string' && entry.name.includes(searchText)) {
                    const beforeCount = entry.name.split(searchText).length - 1;
                    entry.name = entry.name.replaceAll(searchText, newText);
                    totalReplaced += beforeCount;
                }

                if (entry.content && typeof entry.content === 'string' && entry.content.includes(searchText)) {
                    const beforeCount = entry.content.split(searchText).length - 1;
                    entry.content = entry.content.replaceAll(searchText, newText);
                    totalReplaced += beforeCount;
                }

                if (entry.keysText && typeof entry.keysText === 'string' && entry.keysText.includes(searchText)) {
                    const beforeCount = entry.keysText.split(searchText).length - 1;
                    entry.keysText = entry.keysText.replaceAll(searchText, newText);
                    entry.keys = entry.keysText.split(',').map(k => k.trim()).filter(Boolean);
                    totalReplaced += beforeCount;
                }
            });
        }

        showOperationNotice({ type: 'success', title: '全局替换完成', message: `共替换了 ${totalReplaced} 处文本。` });
        resetGlobalReplaceState();
        showGlobalReplaceModal.value = false;
    };

    const closeGlobalReplaceModal = () => {
        showGlobalReplaceModal.value = false;
        resetGlobalReplaceState();
    };

    return {
        showGlobalReplaceModal,
        replaceForm,
        occurrenceCount,
        occurrenceDetails,
        checkOccurrences,
        executeGlobalReplace,
        closeGlobalReplaceModal,
    };
}
