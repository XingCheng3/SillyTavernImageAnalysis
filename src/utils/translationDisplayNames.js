export const getFieldDisplayName = (field) => {
    const fieldNames = {
        name: '角色名称',
        description: '角色描述',
        personality: '性格特征',
        scenario: '背景场景',
        first_message: '首次问候',
        message_example: '示例对话',
        keywords: '关键词',
        content: '条目内容'
    };
    return fieldNames[field] || field;
};

export const getAdvancedFieldDisplayName = (field) => {
    const fieldNames = {
        system_prompt: '系统提示词',
        post_history_instructions: '历史后指令',
        creator_notes: '作者备注',
        alternate_greetings: '备选问候语'
    };
    return fieldNames[field] || field;
};
