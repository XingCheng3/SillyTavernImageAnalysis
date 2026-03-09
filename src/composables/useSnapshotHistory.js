import { computed, reactive, ref } from 'vue';

export function useSnapshotHistory({ editableData, showOperationNotice }) {
    const snapshots = ref([]);
    const snapshotCursor = ref(-1);
    const snapshotMeta = reactive({
        currentLabel: '',
        initialLabel: ''
    });
    const MAX_SNAPSHOTS = 20;

    const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

    const canUndoSnapshot = computed(() => snapshotCursor.value > 0 && snapshots.value.length > 0);
    const canRestoreInitialSnapshot = computed(() => snapshots.value.length > 0 && snapshotCursor.value !== 0);

    const applySnapshotState = (snapshot) => {
        editableData.value = reactive(cloneDeep(snapshot.data));
        snapshotMeta.currentLabel = snapshot.label;
    };

    function pushSnapshot(label = '手动快照') {
        if (!editableData.value) return;

        const nextSnapshots = snapshots.value.slice(0, snapshotCursor.value + 1);
        nextSnapshots.push({
            label,
            createdAt: Date.now(),
            data: cloneDeep(editableData.value)
        });

        if (nextSnapshots.length > MAX_SNAPSHOTS) {
            nextSnapshots.shift();
        }

        snapshots.value = nextSnapshots;
        snapshotCursor.value = snapshots.value.length - 1;
        snapshotMeta.currentLabel = label;
        if (!snapshotMeta.initialLabel) {
            snapshotMeta.initialLabel = label;
        }
    }

    const resetSnapshots = () => {
        snapshots.value = [];
        snapshotCursor.value = -1;
        snapshotMeta.currentLabel = '';
        snapshotMeta.initialLabel = '';
    };

    const saveManualSnapshot = () => {
        pushSnapshot(`手动快照 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
        showOperationNotice({
            type: 'success',
            title: '快照已保存',
            message: snapshotMeta.currentLabel || '当前编辑状态已保存为快照。',
        });
    };

    const undoLastSnapshot = () => {
        if (!canUndoSnapshot.value) return;
        snapshotCursor.value -= 1;
        applySnapshotState(snapshots.value[snapshotCursor.value]);
    };

    const restoreInitialSnapshot = () => {
        if (!snapshots.value.length) return;
        snapshotCursor.value = 0;
        applySnapshotState(snapshots.value[0]);
    };

    return {
        snapshots,
        snapshotCursor,
        snapshotMeta,
        canUndoSnapshot,
        canRestoreInitialSnapshot,
        pushSnapshot,
        resetSnapshots,
        saveManualSnapshot,
        undoLastSnapshot,
        restoreInitialSnapshot,
    };
}
