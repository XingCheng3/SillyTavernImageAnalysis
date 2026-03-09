import { reactive } from 'vue';
import {
    buildEditableCharacterData,
    createEmptyBookEntry,
    createEmptyCharacterBook,
    detectCharacterSpec,
    hasEditableCharacterBook,
    isV3Spec,
} from '@/utils/editorCardAdapter';

export function useCharacterEditor({ characterData, editableData, pushSnapshot, resetSnapshots }) {
    const initEditableData = () => {
        if (!characterData.value) return;

        console.log('初始化可编辑数据开始...');
        console.log('角色卡原始数据:', characterData.value);

        const normalizedEditableData = buildEditableCharacterData(characterData.value);
        editableData.value = reactive(normalizedEditableData);

        resetSnapshots();
        pushSnapshot('初始导入');

        console.log('初始化了', editableData.value.book_entries.length, '个世界书条目');
        console.log('最终可编辑数据:', editableData.value);
    };

    const createCharacterBook = () => {
        pushSnapshot('创建世界书');
        if (!editableData.value.character_book) {
            editableData.value.character_book = createEmptyCharacterBook({ name: '新建世界书' });
        }

        if (!Array.isArray(editableData.value.book_entries)) {
            editableData.value.book_entries = [];
        }
    };

    const addAlternateGreeting = () => {
        pushSnapshot('新增备选问候语');
        if (!editableData.value.alternate_greetings) {
            editableData.value.alternate_greetings = [];
        }
        editableData.value.alternate_greetings = [...editableData.value.alternate_greetings, ''];
    };

    const removeAlternateGreeting = (index) => {
        pushSnapshot('删除备选问候语');
        editableData.value.alternate_greetings = editableData.value.alternate_greetings.filter((_, i) => i !== index);
    };

    const addBookEntry = () => {
        pushSnapshot('新增世界书条目');
        const newIndex = editableData.value.book_entries ? editableData.value.book_entries.length : 0;
        editableData.value.book_entries = [...(editableData.value.book_entries || []), createEmptyBookEntry(newIndex)];
    };

    const removeBookEntry = (index) => {
        pushSnapshot('删除世界书条目');
        editableData.value.book_entries = editableData.value.book_entries.filter((_, i) => i !== index);
    };

    const updateEntryKeys = (entry) => {
        if (!entry.keysText) {
            entry.keys = [];
            return;
        }

        const keyArray = entry.keysText.split(',');
        entry.keys = keyArray.map(k => k.trim()).filter(Boolean);
        console.log('更新后的关键词:', entry.keys);
    };

    const isV3Card = () => isV3Spec(detectCharacterSpec(characterData.value));
    const hasCharacterBook = () => hasEditableCharacterBook(editableData.value);
    const getSpecVersion = () => characterData.value ? detectCharacterSpec(characterData.value) : '未知';

    return {
        initEditableData,
        createCharacterBook,
        addAlternateGreeting,
        removeAlternateGreeting,
        addBookEntry,
        removeBookEntry,
        updateEntryKeys,
        isV3Card,
        hasCharacterBook,
        getSpecVersion,
    };
}
