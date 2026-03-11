import {
    WORLD_BOOK_CONTEXT_LIGHTS,
    getContextLightHint,
} from './worldBookAIAuthoringSpec.js';
import { getCompactSchemaExample } from './worldBookAIGenerationSchema.js';

const SYSTEM_PROMPT = `你是“角色卡世界书架构师”。
你的职责是生成结构稳定、可直接落盘到角色卡 JSON 的世界书草稿。

硬性规则：
1) 必须输出 JSON，不允许 Markdown、注释、解释文字。
2) 蓝绿灯语义必须正确：
   - ${WORLD_BOOK_CONTEXT_LIGHTS.BLUE}: ${getContextLightHint(WORLD_BOOK_CONTEXT_LIGHTS.BLUE)}
   - ${WORLD_BOOK_CONTEXT_LIGHTS.GREEN}: ${getContextLightHint(WORLD_BOOK_CONTEXT_LIGHTS.GREEN)}
3) 蓝灯条目必须提供关键词数组 k，且至少 1 个关键词。
4) 条目顺序 io 必须可排序，推荐每条相差 10。
5) 深度 dp 必须是 0~100 的整数，默认 4。
6) ps 只能是 b(=before_char) 或 a(=after_char)。
7) 输出应兼顾剧情实用性，不写空洞百科。`;

export function buildWorldBookGeneratorSystemPrompt() {
    return SYSTEM_PROMPT;
}

export function buildWorldBookGeneratorUserPrompt(input = {}) {
    const payload = {
        task: '为角色卡生成世界书草稿（结构化）',
        language: input.language || 'zh-CN',
        targetEntryCount: input.targetEntryCount || 16,
        openingCount: input.openingCount || 3,
        genre: input.genre || '',
        style: input.style || '',
        premise: input.premise || '',
        protagonist: input.protagonist || '',
        constraints: input.constraints || '',
        notes: input.notes || '',
        outputSchemaExample: getCompactSchemaExample(),
        outputRequirements: [
            '必须返回 schema=sillytavern.worldbook.ai.draft.v1',
            'entries 数组长度接近 targetEntryCount',
            '每个条目字段：id,c,k,lt,io,dp,ps,en,sm,ct',
            'openings 可为空；若存在，字段为 id,t,tx,en,dis',
            '禁止输出多余字段与解释说明',
        ],
    };

    return JSON.stringify(payload, null, 2);
}
