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

function buildBasePayload(input = {}) {
    return {
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
}

export function buildCharacterAICreateStructureUserPrompt(input = {}) {
    const payload = {
        task: '从 0 生成角色卡结构草稿（阶段1：骨架）',
        stage: 'structure',
        ...buildBasePayload(input),
        stageRules: [
            '重点先保证角色卡与世界书结构正确',
            '允许 worldbook.entries[*].ct 暂时较短或留空',
            '必须提供每个条目的摘要 sm 和关键词 k（蓝灯必填）',
            '开场分支可先给简版文案',
        ],
    };

    return JSON.stringify(payload, null, 2);
}

export function buildCharacterAICreateExpandUserPrompt(input = {}, structureDraft = {}) {
    const payload = {
        task: '从结构草稿扩写为可直接应用的完整角色卡（阶段2：细化）',
        stage: 'expand',
        ...buildBasePayload(input),
        structureDraft,
        stageRules: [
            '保持条目 id 不变并沿用已给结构',
            '补全 worldbook.entries[*].ct，要求有实际剧情价值',
            '完善 card.first_message 与 alternate_greetings',
            '不要删除既有条目，除非明确冲突且给出替代内容',
        ],
    };

    return JSON.stringify(payload, null, 2);
}

export function buildCharacterAICreateUserPrompt(input = {}) {
    const payload = {
        task: '从 0 生成角色卡草稿（含世界书）',
        stage: 'single',
        ...buildBasePayload(input),
    };

    return JSON.stringify(payload, null, 2);
}
