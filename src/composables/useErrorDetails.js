export function useErrorDetails({ openErrorModal }) {
    const showErrorDetails = (errorDetails = {}) => {
        let message = '详细错误信息:\n\n';

        if (errorDetails.code) {
            message += `错误代码: ${errorDetails.code}\n`;
        }

        if (errorDetails.type) {
            message += `错误类型: ${errorDetails.type}\n`;
        }

        if (errorDetails.message) {
            message += `错误信息: ${errorDetails.message}\n`;
        }

        if (errorDetails.status) {
            message += `HTTP状态: ${errorDetails.status}\n`;
        }

        if (errorDetails.statusText) {
            message += `状态文本: ${errorDetails.statusText}\n`;
        }

        const excludeKeys = ['code', 'type', 'message', 'status', 'statusText'];
        Object.keys(errorDetails).forEach(key => {
            if (!excludeKeys.includes(key) && errorDetails[key] !== null && errorDetails[key] !== undefined) {
                message += `${key}: ${JSON.stringify(errorDetails[key])}\n`;
            }
        });

        openErrorModal({
            title: '错误详情',
            message: errorDetails?.message || '发生了一次需要关注的错误。',
            details: message,
        });
    };

    return {
        showErrorDetails,
    };
}
