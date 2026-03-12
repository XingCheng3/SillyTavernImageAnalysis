import { ref } from 'vue';
import {
    buildCharacterAICreateExpandUserPrompt,
    buildCharacterAICreateStructureUserPrompt,
    buildCharacterAICreateSystemPrompt,
    buildCharacterAICreateUserPrompt,
    buildCharacterAIJsonRepairUserPrompt,
    buildCharacterAISchemaRepairUserPrompt,
    buildWorldBookEntryCompletionUserPrompt,
    getCharacterAIDraftJsonSchema,
    getWorldBookEntryCompletionJsonSchema,
} from '@/utils/characterAICreationPrompt';
import {
    CHARACTER_CREATE_GENERATION_MODES,
    validateCharacterCreateInput,
    validateCharacterDraft,
} from '@/utils/characterAICreationValidator';
import {
    buildContentRetryFailures,
    isRecoverableContentOnlyErrors,
    mergeRetryFailureLists,
} from '@/utils/characterAICreationRetry';
import {
    buildCharacterTemplateFromDraft as buildCharacterTemplateFromDraftUtil,
} from '@/utils/characterAICreationApply';

const JSON_REPAIR_SYSTEM_PROMPT = `你是严格 JSON 修复器。
只输出合法 JSON，不要 markdown，不要解释。`;

const ENTRY_RETRY_CONCURRENCY = 3;
const NETWORK_RETRY_MAX_ATTEMPTS = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 800;

const RESPONSE_FORMAT_MODES = Object.freeze({
    JSON_SCHEMA: 'json_schema',
    JSON_OBJECT: 'json_object',
    NONE: 'none',
});

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const responseFormatModeCache = new Map();

function stripCodeFence(raw = '') {
    let text = String(raw || '').trim();
    if (!text) return '';

    if (text.startsWith('```')) {
        text = text.replace(/^```[a-zA-Z0-9_-]*\s*/, '');
    }

    text = text.replace(/\s*```\s*$/, '');
    return text.trim();
}

function extractJsonText(raw = '') {
    const text = String(raw || '').trim();
    if (!text) return '';

    if (text.startsWith('{') || text.startsWith('[')) {
        return text;
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
        return fenced[1].trim();
    }

    const stripped = stripCodeFence(text);
    if (stripped.startsWith('{') || stripped.startsWith('[')) {
        return stripped;
    }

    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return stripped.slice(firstBrace, lastBrace + 1);
    }

    return stripped;
}

function parseDraftResponse(content = '') {
    const candidates = [];
    const primary = extractJsonText(content);
    if (primary) candidates.push(primary);

    const stripped = stripCodeFence(content);
    if (stripped && stripped !== primary) {
        candidates.push(stripped);
    }

    const rawText = String(content || '').trim();
    if (rawText && rawText !== primary && rawText !== stripped) {
        candidates.push(rawText);
    }

    if (!candidates.length) {
        throw new Error('AI 未返回有效角色卡草稿 JSON。');
    }

    let lastError = null;
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(`角色卡草稿 JSON 解析失败：${lastError?.message || '未知错误'}`);
}

function shouldFallbackWithoutResponseFormat(status, bodyText = '') {
    if (![400, 404, 415, 422].includes(status)) return false;

    const text = String(bodyText || '').toLowerCase();
    return text.includes('response_format')
        || text.includes('json schema')
        || text.includes('json_schema')
        || text.includes('json_object')
        || text.includes('unsupported')
        || text.includes('not support');
}

function sleep(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function getResponseFormatCacheKey(apiSettings = {}) {
    return `${String(apiSettings?.url || '').trim()}|${String(apiSettings?.model || '').trim()}`;
}

function getInitialResponseFormatMode({ apiSettings, jsonSchema }) {
    const cacheKey = getResponseFormatCacheKey(apiSettings);
    const cached = responseFormatModeCache.get(cacheKey);
    if (cached) return cached;

    if (jsonSchema?.schema) {
        return RESPONSE_FORMAT_MODES.JSON_SCHEMA;
    }

    return RESPONSE_FORMAT_MODES.JSON_OBJECT;
}

function getFallbackResponseFormatMode(mode = RESPONSE_FORMAT_MODES.NONE, hasJsonSchema = false) {
    if (mode === RESPONSE_FORMAT_MODES.JSON_SCHEMA) {
        return RESPONSE_FORMAT_MODES.JSON_OBJECT;
    }

    if (mode === RESPONSE_FORMAT_MODES.JSON_OBJECT) {
        return RESPONSE_FORMAT_MODES.NONE;
    }

    if (mode === RESPONSE_FORMAT_MODES.NONE && hasJsonSchema) {
        return null;
    }

    return null;
}

function buildResponseFormat(mode = RESPONSE_FORMAT_MODES.NONE, jsonSchema = null) {
    if (mode === RESPONSE_FORMAT_MODES.JSON_SCHEMA && jsonSchema?.schema) {
        return {
            type: 'json_schema',
            json_schema: {
                name: jsonSchema.name || 'ai_structured_output',
                strict: true,
                schema: jsonSchema.schema,
            },
        };
    }

    if (mode === RESPONSE_FORMAT_MODES.JSON_OBJECT) {
        return { type: 'json_object' };
    }

    return undefined;
}

function parseRetryAfterMs(retryAfterHeader = '') {
    const value = String(retryAfterHeader || '').trim();
    if (!value) return 0;

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds > 0) {
        return Math.max(0, Math.round(seconds * 1000));
    }

    const at = Date.parse(value);
    if (Number.isFinite(at)) {
        return Math.max(0, at - Date.now());
    }

    return 0;
}

function getRetryDelayMs(attempt = 0, retryAfterMs = 0) {
    if (retryAfterMs > 0) {
        return retryAfterMs;
    }

    const exponential = NETWORK_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 200);
    return exponential + jitter;
}

function extractMessageText(choice = {}) {
    const refusal = String(
        choice?.message?.refusal
        ?? choice?.message?.content?.find?.(part => part?.type === 'refusal')?.refusal
        ?? ''
    ).trim();

    if (refusal) {
        throw new Error(`模型拒绝输出：${refusal}`);
    }

    const content = choice?.message?.content;
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        const text = content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part?.type === 'text') return part.text || '';
                if (typeof part?.text === 'string') return part.text;
                return '';
            })
            .join('')
            .trim();

        return text;
    }

    return '';
}

async function requestContentFromModel({
    apiSettings,
    userPrompt,
    temperature = 0.8,
    maxTokens = 6000,
    systemPrompt = buildCharacterAICreateSystemPrompt(),
    responseFormatMode,
    jsonSchema,
}) {
    const hasJsonSchema = Boolean(jsonSchema?.schema);
    const cacheKey = getResponseFormatCacheKey(apiSettings);
    let currentMode = responseFormatMode || getInitialResponseFormatMode({ apiSettings, jsonSchema });

    while (currentMode) {
        let switchedMode = false;

        for (let attempt = 0; attempt < NETWORK_RETRY_MAX_ATTEMPTS; attempt += 1) {
            const payload = {
                model: apiSettings.model,
                temperature,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            };

            const responseFormat = buildResponseFormat(currentMode, jsonSchema);
            if (responseFormat) {
                payload.response_format = responseFormat;
            }

            let response;
            try {
                response = await fetch(`${apiSettings.url}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiSettings.key}`,
                    },
                    body: JSON.stringify(payload),
                });
            } catch (networkError) {
                const isLastAttempt = attempt === NETWORK_RETRY_MAX_ATTEMPTS - 1;
                if (isLastAttempt) {
                    throw new Error(`创建请求失败（网络异常）：${networkError?.message || '未知错误'}`);
                }

                await sleep(getRetryDelayMs(attempt));
                continue;
            }

            if (!response.ok) {
                const text = await response.text();
                const retryAfterMs = parseRetryAfterMs(response.headers?.get?.('retry-after'));
                const isRetryableStatus = RETRYABLE_HTTP_STATUS.has(response.status);
                const isFormatFallback = currentMode !== RESPONSE_FORMAT_MODES.NONE
                    && shouldFallbackWithoutResponseFormat(response.status, text);

                if (isFormatFallback) {
                    const fallbackMode = getFallbackResponseFormatMode(currentMode, hasJsonSchema);
                    if (fallbackMode) {
                        currentMode = fallbackMode;
                        switchedMode = true;
                        break;
                    }
                }

                const isLastAttempt = attempt === NETWORK_RETRY_MAX_ATTEMPTS - 1;
                if (!isLastAttempt && isRetryableStatus) {
                    await sleep(getRetryDelayMs(attempt, retryAfterMs));
                    continue;
                }

                throw new Error(`创建请求失败（HTTP ${response.status}）：${text || response.statusText}`);
            }

            const data = await response.json();
            const choice = data?.choices?.[0] || {};
            const content = extractMessageText(choice);

            if (!String(content || '').trim()) {
                const finishReason = String(choice?.finish_reason || '').trim();
                if (finishReason === 'length') {
                    throw new Error('模型输出被截断（finish_reason=length），请提高 max_tokens 后重试。');
                }
                throw new Error('模型未返回有效文本内容。');
            }

            responseFormatModeCache.set(cacheKey, currentMode);
            return content;
        }

        if (switchedMode) {
            continue;
        }

        const fallbackMode = getFallbackResponseFormatMode(currentMode, hasJsonSchema);
        if (!fallbackMode) break;
        currentMode = fallbackMode;
    }

    throw new Error('创建请求失败：未能从模型获取有效响应内容。');
}

async function requestDraftFromModel({
    apiSettings,
    userPrompt,
    temperature = 0.8,
    maxTokens = 6000,
    schemaHint = '',
    systemPrompt = buildCharacterAICreateSystemPrompt(),
    jsonSchema = null,
}) {
    const content = await requestContentFromModel({
        apiSettings,
        userPrompt,
        temperature,
        maxTokens,
        systemPrompt,
        jsonSchema,
    });

    try {
        return parseDraftResponse(content);
    } catch (parseError) {
        const repairedContent = await requestContentFromModel({
            apiSettings,
            temperature: 0,
            maxTokens,
            systemPrompt: JSON_REPAIR_SYSTEM_PROMPT,
            userPrompt: buildCharacterAIJsonRepairUserPrompt({
                rawText: content,
                schemaHint,
            }),
            jsonSchema,
        });

        try {
            return parseDraftResponse(repairedContent);
        } catch (repairError) {
            throw new Error(`${parseError.message}；JSON修复失败：${repairError.message}`);
        }
    }
}

function parseEntryCompletionResponse(raw = {}) {
    const content = String(raw?.ct ?? raw?.content ?? raw?.text ?? '').trim();
    const summary = String(raw?.sm ?? raw?.summary ?? '').trim();

    if (!content) {
        throw new Error('补全结果缺少 ct/content。');
    }

    return {
        content,
        summary,
    };
}

function collectMissingContentEntryIndexes(entries = []) {
    return entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => !String(entry?.content || '').trim())
        .map(({ index }) => index);
}

async function retryFillWorldbookEntryContent({
    apiSettings,
    input,
    draft,
    entry,
    entryIndex,
}) {
    const raw = await requestDraftFromModel({
        apiSettings,
        userPrompt: buildWorldBookEntryCompletionUserPrompt({
            input,
            draft,
            entry,
            entryIndex,
        }),
        temperature: 0.65,
        maxTokens: 1600,
        schemaHint: '{"ct":"string","sm":"string(optional)"}',
        jsonSchema: {
            name: 'worldbook_entry_completion',
            schema: getWorldBookEntryCompletionJsonSchema(),
        },
    });

    return parseEntryCompletionResponse(raw);
}

function buildRetryWarning(failures = []) {
    if (!failures.length) return null;
    return {
        path: 'worldbook.entries',
        code: 'ENTRY_RETRY_PARTIAL_FAILED',
        message: `阶段2按条目补全存在失败项：${failures.map(item => item.entryId).join(', ')}`,
    };
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildSchemaRepairDraft(normalizedDraft = {}) {
    return {
        schema: normalizedDraft?.schema || '',
        card: cloneJson(normalizedDraft?.card || {}),
        worldbook: cloneJson(normalizedDraft?.worldbookDraft || {}),
    };
}

async function runInPool(items = [], worker, concurrency = ENTRY_RETRY_CONCURRENCY) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const results = new Array(items.length);
    let nextIndex = 0;

    const runner = async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            try {
                const value = await worker(items[currentIndex], currentIndex);
                results[currentIndex] = { ok: true, value };
            } catch (error) {
                results[currentIndex] = { ok: false, error };
            }
        }
    };

    const poolSize = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: poolSize }, () => runner()));

    return results;
}

export function useCharacterAICreation({ apiSettings, openErrorModal, showOperationNotice }) {
    const isGenerating = ref(false);
    const generationStageLabel = ref('');
    const draft = ref(null);
    const draftWarnings = ref([]);
    const retryFailures = ref([]);
    const lastNormalizedInput = ref(null);

    const generateDraft = async (input = {}) => {
        const inputValidation = validateCharacterCreateInput(input);
        if (!inputValidation.ok) {
            throw new Error(inputValidation.errors.map(item => item.message).join('\n'));
        }

        if (!apiSettings.value?.url || !apiSettings.value?.model) {
            throw new Error('请先配置 API URL 和模型后再创建角色卡。');
        }

        isGenerating.value = true;
        generationStageLabel.value = '准备中';
        retryFailures.value = [];
        lastNormalizedInput.value = cloneJson(inputValidation.normalized);

        try {
            let validation;
            const retryStats = {
                attempted: 0,
                completed: 0,
                failed: [],
            };

            if (inputValidation.normalized.generationMode === CHARACTER_CREATE_GENERATION_MODES.TWO_STEP) {
                generationStageLabel.value = '阶段1：生成结构骨架';
                const structureRawDraft = await requestDraftFromModel({
                    apiSettings: apiSettings.value,
                    userPrompt: buildCharacterAICreateStructureUserPrompt(inputValidation.normalized),
                    temperature: 0.45,
                    maxTokens: 7000,
                    schemaHint: 'sillytavern.character.ai.draft.v1',
                    jsonSchema: {
                        name: 'character_draft',
                        schema: getCharacterAIDraftJsonSchema(),
                    },
                });

                const structureValidation = validateCharacterDraft(structureRawDraft, {
                    requireWorldbookContent: false,
                });

                if (!structureValidation.ok) {
                    throw new Error(structureValidation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
                }

                let retryBaseDraft = structureValidation.normalized;
                let expandedStrictValidation = null;

                try {
                    generationStageLabel.value = '阶段2：扩写细化内容';
                    const expandedRawDraft = await requestDraftFromModel({
                        apiSettings: apiSettings.value,
                        userPrompt: buildCharacterAICreateExpandUserPrompt(inputValidation.normalized, structureValidation.normalized),
                        temperature: 0.65,
                        maxTokens: 7000,
                        schemaHint: 'sillytavern.character.ai.draft.v1',
                        jsonSchema: {
                            name: 'character_draft',
                            schema: getCharacterAIDraftJsonSchema(),
                        },
                    });

                    const expandedRelaxedValidation = validateCharacterDraft(expandedRawDraft, {
                        requireWorldbookContent: false,
                    });

                    if (!expandedRelaxedValidation.ok) {
                        throw new Error(expandedRelaxedValidation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
                    }

                    retryBaseDraft = expandedRelaxedValidation.normalized;
                    expandedStrictValidation = validateCharacterDraft(expandedRawDraft, {
                        requireWorldbookContent: true,
                    });
                } catch (stage2Error) {
                    showOperationNotice?.({
                        type: 'warning',
                        title: '阶段2扩写失败，开始按条目补全重试',
                        message: stage2Error.message,
                        duration: 4500,
                    });
                }

                if (!expandedStrictValidation || !expandedStrictValidation.ok) {
                    const candidateDraft = JSON.parse(JSON.stringify(retryBaseDraft));
                    const missingIndexes = collectMissingContentEntryIndexes(candidateDraft?.worldbookDraft?.entries || []);

                    retryStats.attempted = missingIndexes.length;

                    if (missingIndexes.length) {
                        let settledCount = 0;

                        const retryResults = await runInPool(
                            missingIndexes,
                            async (entryIndex, queueIndex) => {
                                const targetEntry = candidateDraft.worldbookDraft.entries[entryIndex];
                                generationStageLabel.value = `阶段2补全：重试 ${queueIndex + 1}/${missingIndexes.length}`;

                                try {
                                    const completion = await retryFillWorldbookEntryContent({
                                        apiSettings: apiSettings.value,
                                        input: inputValidation.normalized,
                                        draft: candidateDraft,
                                        entry: targetEntry,
                                        entryIndex,
                                    });

                                    targetEntry.content = completion.content;
                                    if (completion.summary) {
                                        targetEntry.summary = completion.summary;
                                    }

                                    return {
                                        entryId: String(targetEntry?.id ?? entryIndex),
                                        entryTitle: targetEntry?.title || targetEntry?.comment || `条目 ${entryIndex + 1}`,
                                        entryIndex,
                                    };
                                } finally {
                                    settledCount += 1;
                                    generationStageLabel.value = `阶段2补全：已完成 ${settledCount}/${missingIndexes.length}`;
                                }
                            },
                        );

                        retryResults.forEach((result, idx) => {
                            const entryIndex = missingIndexes[idx];
                            const targetEntry = candidateDraft.worldbookDraft.entries[entryIndex];

                            if (result?.ok) {
                                retryStats.completed += 1;
                                return;
                            }

                            retryStats.failed.push({
                                entryId: String(targetEntry?.id ?? entryIndex),
                                entryTitle: targetEntry?.title || targetEntry?.comment || `条目 ${entryIndex + 1}`,
                                entryIndex,
                                message: result?.error?.message || '未知错误',
                            });
                        });
                    }

                    validation = validateCharacterDraft(candidateDraft, {
                        requireWorldbookContent: true,
                    });
                } else {
                    validation = expandedStrictValidation;
                }
            } else {
                generationStageLabel.value = '单阶段生成';
                const rawDraft = await requestDraftFromModel({
                    apiSettings: apiSettings.value,
                    userPrompt: buildCharacterAICreateUserPrompt(inputValidation.normalized),
                    temperature: 0.65,
                    maxTokens: 7000,
                    schemaHint: 'sillytavern.character.ai.draft.v1',
                    jsonSchema: {
                        name: 'character_draft',
                        schema: getCharacterAIDraftJsonSchema(),
                    },
                });

                validation = validateCharacterDraft(rawDraft, {
                    requireWorldbookContent: true,
                });
            }

            if (!validation.ok) {
                try {
                    generationStageLabel.value = '结构修复：校验错误重写';
                    const repairedRawDraft = await requestDraftFromModel({
                        apiSettings: apiSettings.value,
                        userPrompt: buildCharacterAISchemaRepairUserPrompt({
                            draft: buildSchemaRepairDraft(validation.normalized),
                            errors: validation.errors,
                            input: inputValidation.normalized,
                            stage: inputValidation.normalized.generationMode,
                        }),
                        temperature: 0.2,
                        maxTokens: 7000,
                        schemaHint: 'sillytavern.character.ai.draft.v1',
                        jsonSchema: {
                            name: 'character_draft',
                            schema: getCharacterAIDraftJsonSchema(),
                        },
                    });

                    const repairedValidation = validateCharacterDraft(repairedRawDraft, {
                        requireWorldbookContent: true,
                    });

                    const previousErrorCount = validation.errors.length;
                    if (
                        repairedValidation.ok
                        || repairedValidation.errors.length < previousErrorCount
                    ) {
                        validation = repairedValidation;
                        showOperationNotice?.({
                            type: repairedValidation.ok ? 'success' : 'warning',
                            title: repairedValidation.ok ? '草稿结构修复成功' : '草稿结构已部分修复',
                            message: repairedValidation.ok
                                ? '校验修复后已通过。'
                                : `错误数量 ${previousErrorCount} -> ${repairedValidation.errors.length}`,
                            duration: 4200,
                        });
                    }
                } catch (repairError) {
                    showOperationNotice?.({
                        type: 'warning',
                        title: '校验修复未成功',
                        message: repairError.message,
                        duration: 4200,
                    });
                }
            }

            const retryFailuresFromValidation = buildContentRetryFailures(
                validation.errors,
                validation.normalized?.worldbookDraft?.entries || [],
            );
            const combinedRetryFailures = mergeRetryFailureLists(retryStats.failed, retryFailuresFromValidation);

            if (!validation.ok) {
                if (isRecoverableContentOnlyErrors(validation.errors)) {
                    draft.value = validation.normalized;
                    retryFailures.value = combinedRetryFailures;

                    const mergedWarnings = [...validation.warnings];
                    const retryWarning = buildRetryWarning(combinedRetryFailures);
                    if (retryWarning) {
                        mergedWarnings.push(retryWarning);
                    }
                    draftWarnings.value = mergedWarnings;

                    const retryTip = retryStats.attempted > 0
                        ? `，阶段2补全成功 ${retryStats.completed}/${retryStats.attempted}`
                        : '';

                    showOperationNotice?.({
                        type: 'warning',
                        title: '角色卡草稿已生成（待补全条目）',
                        message: `角色名：${validation.normalized.card.name}，仍有 ${combinedRetryFailures.length} 条世界书内容待补全${retryTip}。`,
                        duration: 6000,
                    });

                    return {
                        draft: validation.normalized,
                        warnings: mergedWarnings,
                        retryFailures: combinedRetryFailures,
                        incomplete: true,
                    };
                }

                const baseMessage = validation.errors.map(item => `${item.path}: ${item.message}`).join('\n');
                const retryMessage = retryStats.attempted > 0
                    ? `\n阶段2补全重试：成功 ${retryStats.completed}/${retryStats.attempted}`
                    : '';
                const retryFailedMessage = combinedRetryFailures.length > 0
                    ? `\n补全失败条目：${combinedRetryFailures.map(item => `${item.entryId}(${item.message})`).join('；')}`
                    : '';
                throw new Error(`${baseMessage}${retryMessage}${retryFailedMessage}`);
            }

            draft.value = validation.normalized;
            retryFailures.value = combinedRetryFailures;

            const mergedWarnings = [...validation.warnings];
            const retryWarning = buildRetryWarning(combinedRetryFailures);
            if (retryWarning) {
                mergedWarnings.push(retryWarning);
            }
            draftWarnings.value = mergedWarnings;

            const retryTip = retryStats.attempted > 0
                ? `，阶段2补全成功 ${retryStats.completed}/${retryStats.attempted}`
                : '';

            showOperationNotice?.({
                type: mergedWarnings.length ? 'warning' : 'success',
                title: mergedWarnings.length ? '角色卡草稿已生成（含提醒）' : '角色卡草稿生成成功',
                message: `角色名：${validation.normalized.card.name}，世界书条目：${validation.normalized.worldbookDraft.entries.length}${retryTip}。`,
                duration: 5500,
            });

            return {
                draft: validation.normalized,
                warnings: mergedWarnings,
                retryFailures: combinedRetryFailures,
                incomplete: false,
            };
        } catch (error) {
            openErrorModal?.({
                title: 'AI 创建角色卡失败',
                code: 'AI_CHARACTER_CREATE_FAILED',
                message: error.message,
                details: { message: error.message },
            });
            throw error;
        } finally {
            isGenerating.value = false;
            generationStageLabel.value = '';
        }
    };

    const retryFailedEntries = async ({ entryIds } = {}) => {
        if (!draft.value) {
            throw new Error('当前没有可重试补全的角色草稿。');
        }

        if (!apiSettings.value?.url || !apiSettings.value?.model) {
            throw new Error('请先配置 API URL 和模型后再重试。');
        }

        const input = lastNormalizedInput.value;
        if (!input) {
            throw new Error('缺少创建输入上下文，请重新生成角色草稿后再重试。');
        }

        const requestedIds = Array.isArray(entryIds)
            ? new Set(entryIds.map(v => String(v)))
            : null;

        const targets = retryFailures.value.filter((item) => {
            if (!requestedIds) return true;
            return requestedIds.has(String(item.entryId));
        });

        if (!targets.length) {
            throw new Error('没有可重试的失败条目。');
        }

        isGenerating.value = true;
        generationStageLabel.value = '阶段2补全：手动重试失败条目';

        try {
            const candidateDraft = cloneJson(draft.value);
            const runtimeFailures = [];
            let completed = 0;

            if (targets.length) {
                let settledCount = 0;

                const retryResults = await runInPool(
                    targets,
                    async (target, queueIndex) => {
                        const entries = candidateDraft?.worldbookDraft?.entries || [];
                        const entryIndex = entries.findIndex(entry => String(entry?.id) === String(target.entryId));
                        generationStageLabel.value = `阶段2补全：手动重试 ${queueIndex + 1}/${targets.length}`;

                        try {
                            if (entryIndex < 0) {
                                throw new Error('目标条目不存在，可能已被删除。');
                            }

                            const completion = await retryFillWorldbookEntryContent({
                                apiSettings: apiSettings.value,
                                input,
                                draft: candidateDraft,
                                entry: entries[entryIndex],
                                entryIndex,
                            });

                            entries[entryIndex].content = completion.content;
                            if (completion.summary) {
                                entries[entryIndex].summary = completion.summary;
                            }

                            return {
                                entryId: String(target.entryId),
                                entryTitle: target.entryTitle || target.entryId,
                            };
                        } finally {
                            settledCount += 1;
                            generationStageLabel.value = `阶段2补全：已完成 ${settledCount}/${targets.length}`;
                        }
                    },
                );

                retryResults.forEach((result, idx) => {
                    if (result?.ok) {
                        completed += 1;
                        return;
                    }

                    const target = targets[idx] || {};
                    runtimeFailures.push({
                        entryId: String(target.entryId ?? ''),
                        entryTitle: target.entryTitle || target.entryId || '',
                        message: result?.error?.message || '未知错误',
                    });
                });
            }

            const validation = validateCharacterDraft(candidateDraft, {
                requireWorldbookContent: true,
            });

            const validationFailures = buildContentRetryFailures(
                validation.errors,
                validation.normalized?.worldbookDraft?.entries || [],
            );
            const remainingFailures = mergeRetryFailureLists(runtimeFailures, validationFailures);

            if (!validation.ok && !isRecoverableContentOnlyErrors(validation.errors)) {
                const message = validation.errors.map(item => `${item.path}: ${item.message}`).join('\n');
                throw new Error(message);
            }

            draft.value = validation.normalized;
            retryFailures.value = remainingFailures;

            const mergedWarnings = [...validation.warnings];
            const retryWarning = buildRetryWarning(remainingFailures);
            if (retryWarning) {
                mergedWarnings.push(retryWarning);
            }
            draftWarnings.value = mergedWarnings;

            showOperationNotice?.({
                type: remainingFailures.length > 0 ? 'warning' : 'success',
                title: remainingFailures.length > 0 ? '失败条目重试完成（仍有未补全）' : '失败条目已全部补全',
                message: `本次重试成功 ${completed}/${targets.length}，剩余未补全 ${remainingFailures.length} 条。`,
                duration: 5200,
            });

            return {
                completed,
                attempted: targets.length,
                remainingFailures,
                warnings: mergedWarnings,
                draft: validation.normalized,
            };
        } catch (error) {
            openErrorModal?.({
                title: '重试失败条目失败',
                code: 'AI_CHARACTER_RETRY_FAILED',
                message: error.message,
                details: { message: error.message },
            });
            throw error;
        } finally {
            isGenerating.value = false;
            generationStageLabel.value = '';
        }
    };

    const buildCharacterTemplateFromDraft = (normalizedDraft) => {
        return buildCharacterTemplateFromDraftUtil(normalizedDraft);
    };

    const clearDraft = () => {
        draft.value = null;
        draftWarnings.value = [];
        retryFailures.value = [];
        generationStageLabel.value = '';
        lastNormalizedInput.value = null;
    };

    return {
        isGenerating,
        generationStageLabel,
        draft,
        draftWarnings,
        retryFailures,
        generateDraft,
        retryFailedEntries,
        buildCharacterTemplateFromDraft,
        clearDraft,
    };
}
