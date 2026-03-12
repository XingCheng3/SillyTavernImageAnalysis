export function useCharacterExport({ characterData, editableData, originalFileBytes, getSpecVersion, showOperationNotice, CharacterCardUtils }) {
    const exportCharacterCard = async () => {
        if (!characterData.value || !editableData.value) {
            showOperationNotice({
                type: 'warning',
                title: '没有可导出的角色卡',
                message: '请先导入角色卡，再进行导出。',
            });
            return;
        }

        try {
            console.log('开始导出，当前数据状态：');
            console.log('characterData.value:', characterData.value);
            console.log('editableData.value:', editableData.value);
            console.log('世界书条目数量:', editableData.value.book_entries?.length || 0);

            const finalCharacterData = JSON.parse(JSON.stringify(characterData.value));

            if (finalCharacterData.data) {
                finalCharacterData.data = editableData.value;
            } else {
                finalCharacterData.data = editableData.value;
                finalCharacterData.spec = finalCharacterData.spec || getSpecVersion();
            }

            const hasCustomCover = !!(originalFileBytes.value && originalFileBytes.value.length > 0);
            const newPngBytes = CharacterCardUtils.exportToPNG(finalCharacterData, originalFileBytes.value);

            const characterName = editableData.value.name || 'character';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `${characterName}_${timestamp}.png`;

            CharacterCardUtils.downloadPNG(newPngBytes, filename);

            showOperationNotice({
                type: hasCustomCover ? 'success' : 'warning',
                title: '导出成功',
                message: hasCustomCover
                    ? `已生成并下载 ${filename}（包含当前封面）`
                    : `已生成并下载 ${filename}（未设置封面，使用默认占位封面）`,
            });
            console.log('角色卡导出成功');

            console.log('导出完成后，数据状态：');
            console.log('characterData.value存在:', !!characterData.value);
            console.log('editableData.value存在:', !!editableData.value);
            console.log('世界书条目数量:', editableData.value?.book_entries?.length || 0);
        } catch (err) {
            console.error('导出失败:', err);
            console.error('导出失败时的数据状态：');
            console.log('characterData.value存在:', !!characterData.value);
            console.log('editableData.value存在:', !!editableData.value);
            showOperationNotice({
                type: 'error',
                title: '导出失败',
                message: err.message,
                duration: 7000,
            });
        }
    };

    return {
        exportCharacterCard,
    };
}
