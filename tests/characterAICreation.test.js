import assert from 'node:assert/strict';
import {
    buildWorldBookEntryCompletionUserPrompt,
    getCharacterAIDraftJsonSchema,
    getCharacterDraftSchemaName,
    getWorldBookEntryCompletionJsonSchema,
} from '../src/utils/characterAICreationPrompt.js';
import {
    normalizeCharacterDraft,
    validateCharacterCreateInput,
    validateCharacterDraft,
} from '../src/utils/characterAICreationValidator.js';
import {
    buildContentRetryFailures,
    isRecoverableContentOnlyErrors,
    mergeRetryFailureLists,
} from '../src/utils/characterAICreationRetry.js';

function testInputValidation() {
    const invalid = validateCharacterCreateInput({
        corePrompt: '',
        targetEntryCount: 16,
        openingCount: 2,
        generationMode: 'single',
    });

    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some(item => item.code === 'CORE_PROMPT_REQUIRED'));

    const badMode = validateCharacterCreateInput({
        corePrompt: 'abc',
        targetEntryCount: 12,
        openingCount: 3,
        generationMode: 'fastest',
    });

    assert.equal(badMode.ok, false);
    assert.ok(badMode.errors.some(item => item.code === 'GENERATION_MODE_INVALID'));

    const valid = validateCharacterCreateInput({
        corePrompt: '创建一个异世界学院战斗女主角色卡',
        targetEntryCount: 12,
        openingCount: 3,
        generationMode: 'two_step',
    });

    assert.equal(valid.ok, true);
    assert.equal(valid.normalized.generationMode, 'two_step');
}

function buildValidDraft() {
    return {
        schema: getCharacterDraftSchemaName(),
        card: {
            name: '艾琳·裂界',
            description: '被卷入裂界战争的学院新生。',
            personality: '冷静、戒备心强，但会保护弱者。',
            scenario: '裂界风暴席卷都市，学院被迫军事化。',
            first_message: '你终于来了，裂界今晚会再次开启。',
            alternate_greetings: ['别靠近那道门。', '你还记得我们上次失败的原因吗？'],
            creator_notes: '强调命运抗争和成长弧线。',
            system_prompt: '保持战斗叙事张力，避免流水账。',
            post_history_instructions: '在关键节点给出明确行动选项。',
            message_example: '<START>\n{{user}}：你准备好了吗？\n{{char}}：我不会再退后。\n<END>',
        },
        worldbook: {
            schema: 'sillytavern.worldbook.ai.draft.v1',
            book: {
                name: '裂界学院世界书',
                description: '学院、势力与裂界规则',
            },
            generation: {
                language: 'zh-CN',
                targetEntryCount: 3,
                openingCount: 2,
                notes: '',
            },
            entries: [
                {
                    id: 'E01',
                    c: '世界规则',
                    k: ['裂界', '代价'],
                    lt: 'green',
                    io: 10,
                    dp: 4,
                    ps: 'b',
                    en: true,
                    sm: '核心规则',
                    ct: '裂界每次开启都会吞噬记忆，越强者代价越大。'.repeat(2),
                },
                {
                    id: 'E02',
                    c: '学院纪律',
                    k: ['学院', '纪律'],
                    lt: 'blue',
                    io: 20,
                    dp: 4,
                    ps: 'b',
                    en: true,
                    sm: '纪律体系',
                    ct: '学院禁止私自触碰裂界遗物，违者会被永久流放。'.repeat(2),
                },
                {
                    id: 'E03',
                    c: '敌对组织',
                    k: ['暮影会', '敌对'],
                    lt: 'blue',
                    io: 30,
                    dp: 4,
                    ps: 'b',
                    en: true,
                    sm: '主要对手',
                    ct: '暮影会试图通过牺牲平民稳定裂界，手段极端且高效。'.repeat(2),
                },
            ],
            openings: [
                {
                    id: 'OP1',
                    t: '裂界警报夜',
                    tx: '警报响彻校园，所有新生被紧急集结。',
                    en: ['E01'],
                    dis: ['E03'],
                },
            ],
        },
    };
}

function testDraftNormalizationAndValidation() {
    const normalized = normalizeCharacterDraft(buildValidDraft());
    assert.equal(normalized.card.name, '艾琳·裂界');
    assert.equal(normalized.worldbookDraft.entries.length, 3);

    const result = validateCharacterDraft(buildValidDraft());
    assert.equal(result.ok, true);
    assert.equal(result.normalized.worldbookDraft.book.name, '裂界学院世界书');
}

function testMessageExamplePlaceholderValidation() {
    const bad = buildValidDraft();
    bad.card.message_example = '<START>\n用户：你好\n角色：你好\n<END>';

    const result = validateCharacterDraft(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(item => item.code === 'MESSAGE_EXAMPLE_USER_PLACEHOLDER_REQUIRED'));
    assert.ok(result.errors.some(item => item.code === 'MESSAGE_EXAMPLE_CHAR_PLACEHOLDER_REQUIRED'));
}

function testNestedWorldbookFallback() {
    const nested = buildValidDraft();
    nested.card.worldbook = nested.worldbook;
    delete nested.worldbook;

    const normalized = normalizeCharacterDraft(nested);
    assert.equal(normalized.worldbookDraft.entries.length, 3);

    const result = validateCharacterDraft(nested);
    assert.equal(result.ok, true);
    assert.equal(result.normalized.worldbookDraft.entries[0].id, 'E01');
}

function testCharacterBookFallbackAndObjectEntries() {
    const draft = buildValidDraft();
    draft.character_book = {
        ...draft.worldbook,
        entries: {
            E01: draft.worldbook.entries[0],
            E02: draft.worldbook.entries[1],
            E03: draft.worldbook.entries[2],
        },
    };
    delete draft.worldbook;

    const normalized = normalizeCharacterDraft(draft);
    assert.equal(normalized.worldbookDraft.entries.length, 3);
    assert.equal(normalized.worldbookDraft.entries[1].id, 'E02');

    const result = validateCharacterDraft(draft);
    assert.equal(result.ok, true);
    assert.equal(result.normalized.worldbookDraft.entries[2].id, 'E03');
}

function testLegacyCardFieldFallback() {
    const legacy = buildValidDraft();
    legacy.card = {
        ...legacy.card,
        first_mes: legacy.card.first_message,
        mes_example: legacy.card.message_example,
    };
    delete legacy.card.first_message;
    delete legacy.card.message_example;

    const normalized = normalizeCharacterDraft(legacy);
    assert.equal(normalized.card.first_message.includes('裂界'), true);
    assert.equal(normalized.card.message_example.includes('{{user}}'), true);

    const result = validateCharacterDraft(legacy);
    assert.equal(result.ok, true);
}

function testTwoStepStructureValidationMode() {
    const structureDraft = buildValidDraft();
    structureDraft.worldbook.entries.forEach((entry) => {
        entry.ct = '';
    });

    const strict = validateCharacterDraft(structureDraft, { requireWorldbookContent: true });
    assert.equal(strict.ok, false);

    const relaxed = validateCharacterDraft(structureDraft, { requireWorldbookContent: false });
    assert.equal(relaxed.ok, true);
}

function testEntryRetryPromptBuild() {
    const validDraft = validateCharacterDraft(buildValidDraft()).normalized;
    const prompt = buildWorldBookEntryCompletionUserPrompt({
        input: {
            corePrompt: '测试核心设定',
            genre: '异世界',
            style: '高张力',
            relationshipTone: '互相试探',
            notes: '不要写空话',
            language: 'zh-CN',
        },
        draft: validDraft,
        entry: validDraft.worldbookDraft.entries[0],
        entryIndex: 0,
    });

    const parsed = JSON.parse(prompt);
    assert.equal(parsed.stage, 'entry_retry');
    assert.equal(parsed.targetEntry.id, validDraft.worldbookDraft.entries[0].id);
    assert.ok(Array.isArray(parsed.siblingOutline));
    assert.ok(parsed.outputSchema.ct);
}

function testStructuredOutputSchemas() {
    const characterSchema = getCharacterAIDraftJsonSchema();
    assert.equal(characterSchema.type, 'object');
    assert.equal(characterSchema.additionalProperties, false);
    assert.ok(characterSchema.required.includes('schema'));
    assert.ok(characterSchema.required.includes('card'));
    assert.ok(characterSchema.required.includes('worldbook'));
    assert.equal(characterSchema.properties.worldbook.properties.entries.minItems, 1);

    characterSchema.properties.card.required.push('__mutated__');
    const freshCharacterSchema = getCharacterAIDraftJsonSchema();
    assert.equal(freshCharacterSchema.properties.card.required.includes('__mutated__'), false);

    const completionSchema = getWorldBookEntryCompletionJsonSchema();
    assert.equal(completionSchema.type, 'object');
    assert.equal(completionSchema.additionalProperties, false);
    assert.ok(completionSchema.required.includes('ct'));
}

function testRetryFailureHelpers() {
    const errors = [
        { code: 'ENTRY_CONTENT_REQUIRED', path: 'worldbook.entries[1].content', message: '条目内容不能为空' },
        { code: 'ENTRY_CONTENT_REQUIRED', path: 'worldbook.entries[2].content', message: '条目内容不能为空' },
    ];

    assert.equal(isRecoverableContentOnlyErrors(errors), true);

    const entries = [
        { id: 'E01', title: 'A' },
        { id: 'E02', title: 'B' },
        { id: 'E03', title: 'C' },
    ];

    const fromValidation = buildContentRetryFailures(errors, entries);
    assert.equal(fromValidation.length, 2);
    assert.equal(fromValidation[0].entryId, 'E02');

    const merged = mergeRetryFailureLists(
        [{ entryId: 'E02', entryTitle: 'B', message: 'HTTP 502' }],
        fromValidation,
    );
    assert.equal(merged.length, 2);
    assert.ok(merged.some(item => item.entryId === 'E02'));
}

function runAllTests() {
    console.log('🚀 开始运行角色卡 AI 从0创建测试\n');

    testInputValidation();
    console.log('✓ 创建输入校验正确');

    testDraftNormalizationAndValidation();
    console.log('✓ 草稿标准化与结构校验正确');

    testMessageExamplePlaceholderValidation();
    console.log('✓ 用户占位符规则校验正确');

    testNestedWorldbookFallback();
    console.log('✓ worldbook 错层级兼容恢复正确');

    testCharacterBookFallbackAndObjectEntries();
    console.log('✓ character_book 兼容与对象条目恢复正确');

    testLegacyCardFieldFallback();
    console.log('✓ legacy card 字段兼容恢复正确');

    testTwoStepStructureValidationMode();
    console.log('✓ 两阶段结构草稿校验模式正确');

    testEntryRetryPromptBuild();
    console.log('✓ 阶段2单条补全提示词结构正确');

    testStructuredOutputSchemas();
    console.log('✓ Structured Output JSON Schema 约束正确');

    testRetryFailureHelpers();
    console.log('✓ 补全失败聚合与恢复判断正确');

    console.log('\n✅ 角色卡 AI 从0创建测试通过');
}

runAllTests();
