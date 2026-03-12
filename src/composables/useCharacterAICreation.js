import { ref } from 'vue';
import { CharacterCardUtils } from '@/utils/characterCardParser';
import {
    buildCharacterAICreateExpandUserPrompt,
    buildCharacterAICreateStructureUserPrompt,
    buildCharacterAICreateSystemPrompt,
    buildCharacterAICreateUserPrompt,
    buildCharacterAIJsonRepairUserPrompt,
    buildCharacterAISchemaRepairUserPrompt,
    buildWorldBookEntryCompletionUserPrompt,
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

const JSON_REPAIR_SYSTEM_PROMPT = `你是严格 JSON 修复器。
只输出合法 JSON，不要 markdown，不要解释。`;

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

function applyCardFieldsToTemplate(template, card = {}) {
    const data = template.data || {};

    data.name = card.name || data.name || '新角色';
    data.description = card.description || '';
    data.personality = card.personality || '';
    data.scenario = card.scenario || '';
    data.first_mes = card.first_message || '';
    data.alternate_greetings = Array.isArray(card.alternate_greetings)
        ? [...card.alternate_greetings]
        : [];
    data.creator_notes = card.creator_notes || '';
    data.system_prompt = card.system_prompt || '';
    data.post_history_instructions = card.post_history_instructions || '';
    data.mes_example = card.message_example || '';

    template.data = data;
    return template;
}

function shouldFallbackWithoutResponseFormat(status, bodyText = '') {
    if (![400, 404, 415, 422].includes(status)) return false;

    const text = String(bodyText || '').toLowerCase();
    return text.includes('response_format')
        || text.includes('json schema')
        || text.includes('json_object')
        || text.includes('unsupported')
        || text.includes('not support');
}

async function requestContentFromModel({
    apiSettings,
    userPrompt,
    temperature = 0.8,
    maxTokens = 6000,
    strictJson = true,
    systemPrompt = buildCharacterAICreateSystemPrompt(),
}) {
    const payload = {
        model: apiSettings.model,
        temperature,
        max_tokens: maxTokens,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    };

    if (strictJson) {
        payload.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${apiSettings.url}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiSettings.key}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();

        if (strictJson && shouldFallbackWithoutResponseFormat(response.status, text)) {
            return requestContentFromModel({
                apiSettings,
                userPrompt,
                temperature,
                maxTokens,
                strictJson: false,
                systemPrompt,
            });
        }

        throw new Error(`创建请求失败（HTTP ${response.status}）：${text || response.statusText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
}

async function requestDraftFromModel({
    apiSettings,
    userPrompt,
    temperature = 0.8,
    maxTokens = 6000,
    schemaHint = '',
    systemPrompt = buildCharacterAICreateSystemPrompt(),
}) {
    const content = await requestContentFromModel({
        apiSettings,
        userPrompt,
        temperature,
        maxTokens,
        systemPrompt,
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

                    for (let idx = 0; idx < missingIndexes.length; idx += 1) {
                        const entryIndex = missingIndexes[idx];
                        const targetEntry = candidateDraft.worldbookDraft.entries[entryIndex];
                        generationStageLabel.value = `阶段2补全：重试 ${idx + 1}/${missingIndexes.length}`;

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
                            retryStats.completed += 1;
                        } catch (retryError) {
                            retryStats.failed.push({
                                entryId: String(targetEntry?.id ?? entryIndex),
                                entryTitle: targetEntry?.title || targetEntry?.comment || `条目 ${entryIndex + 1}`,
                                entryIndex,
                                message: retryError.message,
                            });
                        }
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

            for (let idx = 0; idx < targets.length; idx += 1) {
                const target = targets[idx];
                const entries = candidateDraft?.worldbookDraft?.entries || [];
                const entryIndex = entries.findIndex(entry => String(entry?.id) === String(target.entryId));
                generationStageLabel.value = `阶段2补全：手动重试 ${idx + 1}/${targets.length}`;

                if (entryIndex < 0) {
                    runtimeFailures.push({
                        entryId: String(target.entryId),
                        entryTitle: target.entryTitle || target.entryId,
                        message: '目标条目不存在，可能已被删除。',
                    });
                    continue;
                }

                try {
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
                    completed += 1;
                } catch (error) {
                    runtimeFailures.push({
                        entryId: String(target.entryId),
                        entryTitle: target.entryTitle || target.entryId,
                        message: error.message,
                    });
                }
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
        const validation = validateCharacterDraft(normalizedDraft || {});
        if (!validation.ok) {
            throw new Error(validation.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
        }

        const template = CharacterCardUtils.createTemplate(validation.normalized.card.name || '新角色');
        applyCardFieldsToTemplate(template, validation.normalized.card);

        return {
            characterData: template,
            worldbookDraft: validation.normalized.worldbookDraft,
            warnings: validation.warnings,
        };
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
