function normalizeString(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function buildEntryDigest(entry = {}, index = 0) {
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
    };
}

const PATCH_PLANNER_SYSTEM_PROMPT = `你是“角色卡世界书改写规划器”。
你的任务是先从世界书目录中挑出真正需要联动修改的条目，而不是直接改写正文。

输出规则：
1) 只输出 JSON，禁止 markdown、解释、额外文本。
2) JSON 结构固定：
{
  "summary": "string",
  "selectedEntryIds": ["entryId"],
  "targets": [
    { "entryId": "string", "reason": "string" }
  ]
}
3) 必须包含 focusEntryId。
4) 只选择真正相关的条目，宁少勿多。
5) 若没有必要联动，其它条目可以不选，只保留 focusEntryId。
6) 不得选择目录中不存在的 entryId。
7) 最终 selectedEntryIds 数量不得超过 maxAffectedEntries。`;

export function buildWorldBookPatchPlannerSystemPrompt() {
    return PATCH_PLANNER_SYSTEM_PROMPT;
}

export function buildWorldBookPatchPlannerUserPrompt({ entries = [], focusEntry = null, patch, maxAffectedEntries = 6 }) {
    const digests = (entries || []).map((entry, index) => buildEntryDigest(entry, index));
    const focusDigest = focusEntry
        ? buildEntryDigest(focusEntry, digests.findIndex(item => item.entryId === String(focusEntry?.id ?? '')))
        : null;

    const payload = {
        task: '根据改写指令选出需要联动修改的世界书条目',
        request: {
            focusEntryId: String(patch?.entryId ?? ''),
            instruction: patch?.instruction || '',
            scope: patch?.scope,
            mode: patch?.mode,
            field: patch?.field,
            paragraphIndex: patch?.paragraphIndex,
            keepStyle: patch?.keepStyle !== false,
        },
        constraints: {
            mustIncludeFocusEntry: true,
            maxAffectedEntries,
            preferFewRelevantEntries: true,
        },
        focusEntry: focusDigest,
        entryCatalog: digests,
        output: {
            format: 'json',
            schema: {
                summary: 'string',
                selectedEntryIds: ['string'],
                targets: [
                    {
                        entryId: 'string',
                        reason: 'string',
                    },
                ],
            },
        },
    };

    return JSON.stringify(payload, null, 2);
}

export function createWorldBookPatchPlannerResult(raw = {}) {
    const targets = Array.isArray(raw?.targets)
        ? raw.targets.map((item) => ({
            entryId: normalizeString(item?.entryId),
            reason: normalizeString(item?.reason),
        })).filter(item => item.entryId)
        : [];

    const selectedEntryIds = Array.isArray(raw?.selectedEntryIds)
        ? raw.selectedEntryIds.map(item => normalizeString(item)).filter(Boolean)
        : targets.map(item => item.entryId);

    return {
        summary: normalizeString(raw?.summary),
        selectedEntryIds: Array.from(new Set(selectedEntryIds)),
        targets,
    };
}

export function validateWorldBookPatchPlannerResult(raw = {}, options = {}) {
    const result = createWorldBookPatchPlannerResult(raw);
    const errors = [];
    const focusEntryId = normalizeString(options.focusEntryId);
    const maxAffectedEntries = Number.isFinite(options.maxAffectedEntries) ? Math.max(1, Math.trunc(options.maxAffectedEntries)) : 6;
    const allowRelatedEntries = options.allowRelatedEntries === true;
    const entries = Array.isArray(options.entries) ? options.entries : [];
    const validEntryIds = new Set(entries.map(item => normalizeString(item?.id)).filter(Boolean));

    if (!focusEntryId) {
        errors.push({
            code: 'PATCH_PLANNER_FOCUS_ENTRY_REQUIRED',
            message: 'planner 校验必须提供 focusEntryId。',
            path: 'focusEntryId',
        });
    }

    if (!result.selectedEntryIds.length && focusEntryId) {
        result.selectedEntryIds = [focusEntryId];
    }

    if (focusEntryId && !result.selectedEntryIds.includes(focusEntryId)) {
        result.selectedEntryIds.unshift(focusEntryId);
    }

    if (!allowRelatedEntries) {
        result.selectedEntryIds = focusEntryId ? [focusEntryId] : result.selectedEntryIds.slice(0, 1);
        result.targets = result.targets.filter(item => item.entryId === focusEntryId);
    }

    if (result.selectedEntryIds.length > maxAffectedEntries) {
        errors.push({
            code: 'PATCH_PLANNER_TOO_MANY_ENTRIES',
            message: `planner 选择了 ${result.selectedEntryIds.length} 个条目，超过上限 ${maxAffectedEntries}。`,
            path: 'selectedEntryIds',
        });
    }

    result.selectedEntryIds.forEach((entryId, index) => {
        if (!validEntryIds.has(entryId)) {
            errors.push({
                code: 'PATCH_PLANNER_ENTRY_NOT_FOUND',
                message: `planner 选择的条目不存在：${entryId}`,
                path: `selectedEntryIds[${index}]`,
            });
        }
    });

    result.targets.forEach((item, index) => {
        if (!validEntryIds.has(item.entryId)) {
            errors.push({
                code: 'PATCH_PLANNER_TARGET_NOT_FOUND',
                message: `planner target 条目不存在：${item.entryId}`,
                path: `targets[${index}].entryId`,
            });
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        normalized: result,
    };
}
