import {
    WORLD_BOOK_PATCH_MODE,
    WORLD_BOOK_PATCH_SCOPE,
} from './worldBookAIPatchSchema.js';

const PATCH_SYSTEM_PROMPT = `你是“角色卡世界书精修编辑器”。
你的任务是按用户指令改写指定目标文本。

输出规则：
1) 只输出 JSON，禁止 markdown 或解释。
2) JSON 结构固定：{"replacement":"..."}
3) replacement 只包含改写后的目标文本本体，不要带字段名、不加前后缀。
4) 保持原语言（默认中文）与角色卡写作风格一致。
5) 如果指令与目标冲突，优先服从用户 instruction。`;

export function buildWorldBookPatchSystemPrompt() {
    return PATCH_SYSTEM_PROMPT;
}

export function buildWorldBookPatchUserPrompt({ entry, patch, targetText }) {
    const payload = {
        task: '按指令改写世界书局部内容',
        target: {
            entryId: String(entry?.id ?? ''),
            entryTitle: String(entry?.name || entry?.comment || '').trim(),
            scope: patch.scope,
            mode: patch.mode,
            field: patch.field,
            paragraphIndex: patch.paragraphIndex,
            keepStyle: patch.keepStyle !== false,
        },
        ruleNotes: {
            scopeSupported: Object.values(WORLD_BOOK_PATCH_SCOPE),
            modeSupported: Object.values(WORLD_BOOK_PATCH_MODE),
        },
        instruction: patch.instruction,
        targetText,
        output: {
            format: 'json',
            schema: { replacement: 'string' },
        },
    };

    return JSON.stringify(payload, null, 2);
}
