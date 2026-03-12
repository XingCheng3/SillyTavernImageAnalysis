import { getCompactSchemaExample } from './worldBookAIGenerationSchema.js';

const CHARACTER_DRAFT_SCHEMA = 'sillytavern.character.ai.draft.v1';

const SYSTEM_PROMPT = `你是“角色卡架构师”。
任务：基于用户提示词，生成可直接落地到 SillyTavern 角色卡的数据草稿。

硬性规则：
1) 只输出 JSON，不允许 markdown、注释或解释。
2) schema 必须是 ${CHARACTER_DRAFT_SCHEMA}
3) 顶层字段必须是 schema / card / worldbook，禁止把 worldbook 放进 card 里。
4) card 字段必须完整：name, description, personality, scenario, first_message, alternate_greetings, creator_notes, system_prompt, post_history_instructions, message_example。
5) worldbook 必须使用紧凑 schema（与世界书 AI 代写一致），蓝绿灯语义正确：
   - blue = 关键词触发
   - green = 直接载入上下文
6) 当 stage=structure 时，worldbook.entries[*].ct 允许为空或占位文本；当 stage=single/expand 时，条目内容必须实用、可用于剧情推进，避免空洞设定。
7) 涉及用户的示例对话必须使用 {{user}} 占位符，角色使用 {{char}} 占位符。`;

export function getCharacterDraftSchemaName() {
    return CHARACTER_DRAFT_SCHEMA;
}

export function buildCharacterAICreateSystemPrompt() {
    return SYSTEM_PROMPT;
}

function getSimpleOutputExample() {
    return {
        schema: CHARACTER_DRAFT_SCHEMA,
        card: {
            name: '示例角色',
            description: '角色背景简介',
            personality: '角色性格要点',
            scenario: '当前世界/开局场景',
            first_message: '这是角色首条开场白。',
            alternate_greetings: ['备选开场白1', '备选开场白2'],
            creator_notes: '作者备注',
            system_prompt: '扮演规则与风格要求',
            post_history_instructions: '持续生效的补充规则',
            message_example: '<START>\n{{user}}：示例提问\n{{char}}：示例回答\n<END>',
        },
        worldbook: {
            schema: 'sillytavern.worldbook.ai.draft.v1',
            book: {
                name: '示例世界书',
                description: '世界书简介',
                genre: '题材标签',
                style: '文风标签',
            },
            generation: {
                language: 'zh-CN',
                targetEntryCount: 2,
                openingCount: 1,
                notes: '示例说明',
            },
            entries: [
                {
                    id: 'E01',
                    c: '世界观总览',
                    k: ['关键词A', '关键词B'],
                    lt: 'green',
                    io: 10,
                    dp: 4,
                    ps: 'b',
                    en: true,
                    sm: '条目摘要',
                    ct: '条目正文（structure 阶段可占位）',
                },
            ],
            openings: [
                {
                    id: 'OP1',
                    t: '开场分支标题',
                    tx: '开场正文',
                    en: ['E01'],
                    dis: [],
                },
            ],
        },
    };
}

const CHARACTER_DRAFT_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'card', 'worldbook'],
    properties: {
        schema: {
            type: 'string',
            enum: [CHARACTER_DRAFT_SCHEMA],
        },
        card: {
            type: 'object',
            additionalProperties: false,
            required: [
                'name',
                'description',
                'personality',
                'scenario',
                'first_message',
                'alternate_greetings',
                'creator_notes',
                'system_prompt',
                'post_history_instructions',
                'message_example',
            ],
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                personality: { type: 'string' },
                scenario: { type: 'string' },
                first_message: { type: 'string' },
                alternate_greetings: {
                    type: 'array',
                    items: { type: 'string' },
                },
                creator_notes: { type: 'string' },
                system_prompt: { type: 'string' },
                post_history_instructions: { type: 'string' },
                message_example: { type: 'string' },
            },
        },
        worldbook: {
            type: 'object',
            additionalProperties: false,
            required: ['schema', 'book', 'generation', 'entries', 'openings'],
            properties: {
                schema: {
                    type: 'string',
                    enum: ['sillytavern.worldbook.ai.draft.v1'],
                },
                book: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'description', 'genre', 'style'],
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        genre: { type: 'string' },
                        style: { type: 'string' },
                    },
                },
                generation: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['language', 'targetEntryCount', 'openingCount', 'notes'],
                    properties: {
                        language: { type: 'string' },
                        targetEntryCount: { type: 'integer', minimum: 1 },
                        openingCount: { type: 'integer', minimum: 0 },
                        notes: { type: 'string' },
                    },
                },
                entries: {
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['id', 'c', 'k', 'lt', 'io', 'dp', 'ps', 'en', 'sm', 'ct'],
                        properties: {
                            id: { type: 'string' },
                            c: { type: 'string' },
                            k: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                            lt: {
                                type: 'string',
                                enum: ['blue', 'green'],
                            },
                            io: { type: 'integer' },
                            dp: { type: 'integer', minimum: 0 },
                            ps: {
                                type: 'string',
                                enum: ['b', 'a'],
                            },
                            en: { type: 'boolean' },
                            sm: { type: 'string' },
                            ct: { type: 'string' },
                        },
                    },
                },
                openings: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['id', 't', 'tx', 'en', 'dis'],
                        properties: {
                            id: { type: 'string' },
                            t: { type: 'string' },
                            tx: { type: 'string' },
                            en: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                            dis: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    },
};

const WORLDBOOK_ENTRY_COMPLETION_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['ct'],
    properties: {
        ct: { type: 'string', minLength: 1 },
        sm: { type: 'string' },
    },
};

function cloneSchema(schema = {}) {
    return JSON.parse(JSON.stringify(schema));
}

export function getCharacterAIDraftJsonSchema() {
    return cloneSchema(CHARACTER_DRAFT_JSON_SCHEMA);
}

export function getWorldBookEntryCompletionJsonSchema() {
    return cloneSchema(WORLDBOOK_ENTRY_COMPLETION_JSON_SCHEMA);
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
        outputRules: [
            '只输出 JSON 本体，禁止 ```json 代码块',
            '禁止输出解释性文字或注释',
            '输出必须可被 JSON.parse 直接解析',
            '顶层字段必须是 schema/card/worldbook，且 worldbook 不能嵌套到 card 内',
            'message_example 必须包含 {{user}} 与 {{char}} 占位符',
        ],
        simpleOutputExample: getSimpleOutputExample(),
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

export function buildWorldBookEntryCompletionUserPrompt({ input = {}, draft = {}, entry = {}, entryIndex = 0 }) {
    const payload = {
        task: '补全世界书单条内容（阶段2失败重试）',
        stage: 'entry_retry',
        language: input.language || 'zh-CN',
        corePrompt: input.corePrompt || '',
        genre: input.genre || '',
        style: input.style || '',
        relationshipTone: input.relationshipTone || '',
        notes: input.notes || '',
        book: {
            name: draft?.worldbookDraft?.book?.name || '',
            description: draft?.worldbookDraft?.book?.description || '',
            entryCount: draft?.worldbookDraft?.entries?.length || 0,
        },
        targetEntry: {
            index: entryIndex,
            id: entry.id,
            title: entry.title,
            summary: entry.summary,
            light: entry.light,
            keywords: entry.keywords,
            insertionOrder: entry.insertionOrder,
            depth: entry.depth,
            position: entry.position,
            currentContent: entry.content || '',
        },
        siblingOutline: (draft?.worldbookDraft?.entries || []).map((item, index) => ({
            index,
            id: item.id,
            title: item.title,
            summary: item.summary,
            hasContent: !!String(item.content || '').trim(),
        })),
        outputSchema: {
            ct: 'string',
            sm: 'string(optional)',
        },
        outputRules: [
            '只输出 JSON，禁止解释文字',
            'ct 必须非空，且具备剧情可用性',
            '不要修改条目 id/title/keywords/light 等结构字段',
        ],
    };

    return JSON.stringify(payload, null, 2);
}

export function buildCharacterAIJsonRepairUserPrompt({ rawText = '', schemaHint = '' } = {}) {
    const payload = {
        task: '修复为严格合法 JSON',
        role: 'json_repairer',
        rules: [
            '只输出 JSON 本体，不要 markdown 代码块，不要解释',
            '修复缺失引号、缺失逗号、未闭合对象/数组、转义错误',
            '保留原始语义，禁止擅自新增无关字段',
            '顶层字段应保持 schema/card/worldbook，禁止把 worldbook 塞入 card',
            'message_example 若存在用户参与，必须包含 {{user}} 与 {{char}} 占位符',
            '如果无法完全恢复，优先保留可确定字段并保证 JSON 可解析',
        ],
        schemaHint,
        simpleOutputExample: getSimpleOutputExample(),
        rawText,
    };

    return JSON.stringify(payload, null, 2);
}

export function buildCharacterAISchemaRepairUserPrompt({ draft = {}, errors = [], input = {}, stage = 'expand' } = {}) {
    const payload = {
        task: '根据校验错误修复角色卡草稿',
        stage: 'schema_repair',
        sourceStage: stage,
        language: input.language || 'zh-CN',
        corePrompt: input.corePrompt || '',
        validationErrors: (errors || []).map((item) => ({
            path: item.path,
            code: item.code,
            message: item.message,
        })),
        rules: [
            '只输出 JSON 本体，不要解释、不要 markdown',
            '顶层必须只有 schema/card/worldbook 三个主字段',
            'worldbook.entries 至少 1 条；蓝灯必须有关键词',
            'message_example 必须包含 {{user}} 与 {{char}}',
            '尽量保留原语义，仅修复结构与缺失项',
        ],
        simpleOutputExample: getSimpleOutputExample(),
        draft,
    };

    return JSON.stringify(payload, null, 2);
}
