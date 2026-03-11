import { getCompactSchemaExample } from './worldBookAIGenerationSchema.js';

const CHARACTER_DRAFT_SCHEMA = 'sillytavern.character.ai.draft.v1';

const SYSTEM_PROMPT = `你是“角色卡架构师”。
任务：基于用户提示词，生成可直接落地到 SillyTavern 角色卡的数据草稿。

硬性规则：
1) 只输出 JSON，不允许 markdown、注释或解释。
2) schema 必须是 ${CHARACTER_DRAFT_SCHEMA}
3) card 字段必须完整：name, description, personality, scenario, first_message, alternate_greetings, creator_notes, system_prompt, post_history_instructions, message_example。
4) worldbook 必须使用紧凑 schema（与世界书 AI 代写一致），蓝绿灯语义正确：
   - blue = 关键词触发
   - green = 直接载入上下文
5) 条目内容必须实用、可用于剧情推进，避免空洞设定。`;

export function getCharacterDraftSchemaName() {
    return CHARACTER_DRAFT_SCHEMA;
}

export function buildCharacterAICreateSystemPrompt() {
    return SYSTEM_PROMPT;
}

export function buildCharacterAICreateUserPrompt(input = {}) {
    const payload = {
        task: '从 0 生成角色卡草稿（含世界书）',
        language: input.language || 'zh-CN',
        corePrompt: input.corePrompt || '',
        genre: input.genre || '',
        style: input.style || '',
        relationshipTone: input.relationshipTone || '',
        targetEntryCount: input.targetEntryCount || 16,
        openingCount: input.openingCount || 3,
        notes: input.notes || '',
        outputSchema: {
            schema: CHARACTER_DRAFT_SCHEMA,
            card: {
                name: 'string',
                description: 'string',
                personality: 'string',
                scenario: 'string',
                first_message: 'string',
                alternate_greetings: ['string'],
                creator_notes: 'string',
                system_prompt: 'string',
                post_history_instructions: 'string',
                message_example: 'string',
            },
            worldbook: getCompactSchemaExample(),
        },
    };

    return JSON.stringify(payload, null, 2);
}
