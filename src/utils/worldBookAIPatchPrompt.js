import {
    WORLD_BOOK_PATCH_ACTION,
    WORLD_BOOK_PATCH_ALLOWED_FIELDS,
} from './worldBookAIPatchSchema.js';

const PATCH_SYSTEM_PROMPT = `你是“角色卡世界书精修编辑器”。
你的任务不是自由重写全文，而是像调用受限编辑工具一样，输出最小 patch operation 列表。

核心规则：
1) 只输出 JSON，禁止 markdown、解释、额外文本。
2) JSON 结构固定：
{
  "summary": "string",
  "selectedEntryIds": ["entryId"],
  "operations": [
    {
      "opId": "string",
      "entryId": "string",
      "field": "content|comment|name|keysText",
      "action": "replace_text|append_after_text|prepend_before_text|replace_paragraph|replace_whole",
      "searchText": "string",
      "replacement": "string",
      "occurrence": 1,
      "paragraphIndex": 0,
      "anchors": { "before": "string", "after": "string" },
      "reason": "string"
    }
  ]
}
3) 优先最小改动：默认优先使用 replace_text；只有在确实必要时才使用 replace_paragraph 或 replace_whole。
4) 不得修改未提供的 entryId。
5) searchText 必须是输入中真实存在的原文片段，不能编造。
6) 若 searchText 在同一字段中可能重复，必须补充 occurrence，必要时再加 anchors。
7) 对 title/name/comment/keysText 这类短字段，允许使用 replace_whole。
8) 如果当前请求未开启关联条目修改，只能修改 focus entry。
9) 如果无法安全生成 patch operations，返回空 operations，并在 summary 中说明原因。`;

export function buildWorldBookPatchSystemPrompt() {
    return PATCH_SYSTEM_PROMPT;
}

function createEntryDigest(entry = {}, index = 0) {
    const content = String(entry?.content ?? '').replace(/\r\n/g, '\n').trim();
    const paragraphs = content
        ? content.split(/\n{2,}/).map(v => v.trim()).filter(Boolean)
        : [];

    return {
        entryId: String(entry?.id ?? ''),
        index,
        title: String(entry?.name || entry?.comment || `条目 ${index + 1}`).trim(),
        keysText: String(entry?.keysText || (Array.isArray(entry?.keys) ? entry.keys.join(', ') : '')).trim(),
        excerpt: content.slice(0, 220),
        paragraphCount: paragraphs.length,
        content,
    };
}

export function buildWorldBookPatchUserPrompt({
    entries = [],
    focusEntry = null,
    patch,
    planner = null,
}) {
    const digests = (entries || []).map((entry, index) => createEntryDigest(entry, index));
    const focusDigest = focusEntry
        ? createEntryDigest(focusEntry, digests.findIndex(item => item.entryId === String(focusEntry?.id ?? '')))
        : null;

    const allowRelatedEntries = patch?.allowRelatedEntries === true;

    const payload = {
        task: '按指令生成世界书 patch operation 列表',
        request: {
            focusEntryId: String(patch?.entryId ?? ''),
            scope: patch?.scope,
            mode: patch?.mode,
            field: patch?.field,
            paragraphIndex: patch?.paragraphIndex,
            instruction: patch?.instruction,
            keepStyle: patch?.keepStyle !== false,
            allowRelatedEntries,
        },
        constraints: {
            maxAffectedEntries: allowRelatedEntries ? 6 : 1,
            maxOperations: allowRelatedEntries ? 12 : 6,
            allowedFields: WORLD_BOOK_PATCH_ALLOWED_FIELDS,
            allowedActions: Object.values(WORLD_BOOK_PATCH_ACTION),
            preferMinimalPatch: true,
            avoidWholeRewriteUnlessNecessary: true,
        },
        focusEntry: focusDigest,
        plannerResult: planner
            ? {
                summary: planner.summary || '',
                selectedEntryIds: planner.selectedEntryIds || [],
                targets: planner.targets || [],
            }
            : undefined,
        entryCatalog: digests.map(({ entryId, index, title, keysText, excerpt, paragraphCount }) => ({
            entryId,
            index,
            title,
            keysText,
            excerpt,
            paragraphCount,
        })),
        entryDetails: digests.map(({ entryId, index, title, keysText, content, paragraphCount }) => ({
            entryId,
            index,
            title,
            keysText,
            paragraphCount,
            content,
        })),
        output: {
            format: 'json',
            schema: {
                summary: 'string',
                selectedEntryIds: ['string'],
                operations: [
                    {
                        opId: 'string',
                        entryId: 'string',
                        field: 'content|comment|name|keysText',
                        action: 'replace_text|append_after_text|prepend_before_text|replace_paragraph|replace_whole',
                        searchText: 'string',
                        replacement: 'string',
                        occurrence: 1,
                        paragraphIndex: 0,
                        anchors: { before: 'string', after: 'string' },
                        reason: 'string',
                    },
                ],
            },
        },
    };

    return JSON.stringify(payload, null, 2);
}
