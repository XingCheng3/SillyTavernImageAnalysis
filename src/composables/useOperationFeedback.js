import { reactive, ref, onBeforeUnmount } from 'vue';

export function useOperationFeedback() {
    const showErrorModal = ref(false);
    const errorModal = reactive({
        title: '提示',
        code: '',
        message: '',
        status: null,
        statusText: '',
        details: null,
        suggestions: []
    });

    const operationNotice = reactive({
        visible: false,
        type: 'info',
        title: '',
        message: ''
    });

    let operationNoticeTimer = null;

    const openErrorModal = (payload = {}) => {
        errorModal.title = payload.title || '提示';
        errorModal.code = payload.code || '';
        errorModal.message = payload.message || '';
        errorModal.status = payload.status ?? null;
        errorModal.statusText = payload.statusText || '';
        errorModal.details = payload.details ?? null;
        errorModal.suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        showErrorModal.value = true;
    };

    const closeErrorModal = () => {
        showErrorModal.value = false;
    };

    const clearOperationNotice = () => {
        operationNotice.visible = false;
        operationNotice.type = 'info';
        operationNotice.title = '';
        operationNotice.message = '';
        if (operationNoticeTimer) {
            clearTimeout(operationNoticeTimer);
            operationNoticeTimer = null;
        }
    };

    const showOperationNotice = ({ type = 'info', title = '提示', message = '', duration = 5000 }) => {
        clearOperationNotice();
        operationNotice.visible = true;
        operationNotice.type = type;
        operationNotice.title = title;
        operationNotice.message = message;

        if (duration > 0) {
            operationNoticeTimer = setTimeout(() => {
                clearOperationNotice();
            }, duration);
        }
    };

    onBeforeUnmount(() => {
        clearOperationNotice();
    });

    return {
        showErrorModal,
        errorModal,
        openErrorModal,
        closeErrorModal,
        operationNotice,
        clearOperationNotice,
        showOperationNotice,
    };
}
