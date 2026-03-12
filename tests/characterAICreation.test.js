import assert from 'node:assert/strict';
import {
    buildWorldBookEntryCompletionUserPrompt,
    getCharacterDraftSchemaName,
} from '../src/utils/characterAICreationPrompt.js';
import {
    normalizeCharacterDraft,
    validateCharacterCreateInput,
    validateCharacterDraft,
} from '../src/utils/characterAICreationValidator.js';

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
            message_example: '她握住刀柄，低声道：这次我不会再退后。',
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

function runAllTests() {
    console.log('🚀 开始运行角色卡 AI 从0创建测试\n');

    testInputValidation();
    console.log('✓ 创建输入校验正确');

    testDraftNormalizationAndValidation();
    console.log('✓ 草稿标准化与结构校验正确');

    testTwoStepStructureValidationMode();
    console.log('✓ 两阶段结构草稿校验模式正确');

    testEntryRetryPromptBuild();
    console.log('✓ 阶段2单条补全提示词结构正确');

    console.log('\n✅ 角色卡 AI 从0创建测试通过');
}

runAllTests();
