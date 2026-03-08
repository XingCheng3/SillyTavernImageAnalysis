// 翻译相关的通用辅助函数

/**
 * 构建完整的翻译提示词
 * @param {object} translationConfig 配置对象（包含 jailbreakText 与 systemPrompt）
 * @param {boolean} includeTagInstructions 是否包含保留XML标签的指令
 * @returns {string}
 */
export function buildTranslationPrompt(translationConfig = {}, includeTagInstructions = false) {
    let prompt = '';

    if (translationConfig.jailbreakText) {
        prompt += '\n\n' + translationConfig.jailbreakText;
    }

    if (translationConfig.systemPrompt) {
        prompt += '\n\n' + translationConfig.systemPrompt;
    }

    if (includeTagInstructions) {
        prompt += '\n\nIMPORTANT: You MUST preserve ALL XML tags exactly as they are (e.g., <TXT1>, </TXT1>, <TXT2>, </TXT2>, etc.). Only translate the text content between the tags, DO NOT translate or modify the tags themselves. Each tag contains a separate text that should be translated independently.';
    }

    return prompt;
}

/**
 * 将错误信息映射为用户友好的提示
 * @param {object} errorDetails
 * @returns {string}
 */
export function getFriendlyErrorMessage(errorDetails) {
    if (!errorDetails) return '未知错误';

    const message = errorDetails.message || '';

    if (message.includes('PROHIBITED_CONTENT') || message.includes('Blocked')) {
        return '内容被AI服务商安全策略阻止，请尝试修改翻译内容或调整破限文本。建议：\n1. 检查是否包含敏感内容\n2. 尝试分段翻译\n3. 调整翻译提示词';
    }

    if (message.includes('quota') || message.includes('limit') || message.includes('rate')) {
        return 'API使用额度或速率限制，请稍后重试或检查API配置。';
    }

    if (message.includes('auth') || message.includes('unauthorized') || message.includes('401')) {
        return 'API认证失败，请检查API密钥是否正确。';
    }

    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        return '网络连接问题，请检查网络连接并重试。';
    }

    if (message.includes('model') || message.includes('not found')) {
        return '模型不存在或不支持，请检查API配置中的模型名称。';
    }

    return message || '未知错误';
}

/**
 * 将错误信息映射为标准错误代码
 * @param {object} errorDetails
 * @returns {string}
 */
export function mapErrorCode(errorDetails) {
    if (!errorDetails) return 'UNKNOWN';
    if (errorDetails.code) return String(errorDetails.code);
    if (errorDetails.status) return `HTTP_${errorDetails.status}`;
    const msg = (errorDetails.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) return 'NETWORK_ERROR';
    return 'UNKNOWN';
}


