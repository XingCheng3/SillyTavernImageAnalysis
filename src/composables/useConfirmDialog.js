import { reactive, shallowRef } from 'vue';

export function useConfirmDialog() {
    const confirmDialog = reactive({
        show: false,
        title: '请确认',
        message: '',
        description: '',
        confirmText: '确认',
        cancelText: '取消',
        variant: 'danger',
    });

    const pendingAction = shallowRef(null);

    const openConfirmDialog = (options, action) => {
        confirmDialog.show = true;
        confirmDialog.title = options.title || '请确认';
        confirmDialog.message = options.message || '';
        confirmDialog.description = options.description || '';
        confirmDialog.confirmText = options.confirmText || '确认';
        confirmDialog.cancelText = options.cancelText || '取消';
        confirmDialog.variant = options.variant || 'danger';
        pendingAction.value = action || null;
    };

    const closeConfirmDialog = () => {
        confirmDialog.show = false;
        pendingAction.value = null;
    };

    const confirmAction = () => {
        const action = pendingAction.value;
        closeConfirmDialog();
        action?.();
    };

    return {
        confirmDialog,
        openConfirmDialog,
        closeConfirmDialog,
        confirmAction,
    };
}
