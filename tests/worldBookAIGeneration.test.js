import assert from 'node:assert/strict';
import {
    WORLD_BOOK_CONTEXT_LIGHTS,
    applyContextLight,
    inferContextLight,
} from '../src/utils/worldBookAIAuthoringSpec.js';
import {
    createWorldBookGenerationDraft,
    expandWorldBookGenerationDraft,
} from '../src/utils/worldBookAIGenerationSchema.js';
import {
    mapDraftEntriesToEditableEntries,
    validateWorldBookGenerationDraft,
} from '../src/utils/worldBookAIGenerationValidator.js';
import {
    WORLD_BOOK_PATCH_MODE,
    WORLD_BOOK_PATCH_SCOPE,
    applyLocalPatchToEntry,
    validatePatchInstruction,
} from '../src/utils/worldBookAIPatchSchema.js';

function testLightInferenceAndApply() {
    assert.equal(inferContextLight({ constant: true, selective: false }), WORLD_BOOK_CONTEXT_LIGHTS.GREEN);
    assert.equal(inferContextLight({ constant: false, selective: true }), WORLD_BOOK_CONTEXT_LIGHTS.BLUE);
    assert.equal(inferContextLight({ keys: ['设定'] }), WORLD_BOOK_CONTEXT_LIGHTS.BLUE);
    assert.equal(inferContextLight({ keys: [] }), WORLD_BOOK_CONTEXT_LIGHTS.GREEN);

    const blueEntry = applyContextLight({}, WORLD_BOOK_CONTEXT_LIGHTS.BLUE);
    assert.equal(blueEntry.selective, true);
    assert.equal(blueEntry.constant, false);

    const greenEntry = applyContextLight({}, WORLD_BOOK_CONTEXT_LIGHTS.GREEN);
    assert.equal(greenEntry.constant, true);
    assert.equal(greenEntry.selective, false);
}

function testSchemaRoundTrip() {
    const draft = createWorldBookGenerationDraft({
        book: { name: '测试世界书', description: '描述' },
        entries: [
            {
                id: 'E01',
                title: '世界观总览',
                keywords: ['裂缝时代'],
                light: WORLD_BOOK_CONTEXT_LIGHTS.GREEN,
                insertionOrder: 10,
                depth: 4,
                position: 'before_char',
                content: '这是一个很长的测试内容，用于确保结构校验可以通过。'.repeat(2),
            },
        ],
        openings: [
            {
                id: 'OP1',
                title: '开场 1',
                text: '第一幕开场',
                enableEntryIds: ['E01'],
                disableEntryIds: [],
            },
        ],
    });

    const expanded = expandWorldBookGenerationDraft(draft);
    assert.equal(expanded.book.name, '测试世界书');
    assert.equal(expanded.entries[0].light, WORLD_BOOK_CONTEXT_LIGHTS.GREEN);
    assert.equal(expanded.entries[0].position, 'before_char');
    assert.equal(expanded.openings[0].enableEntryIds[0], 'E01');
}

function testValidatorAndMapping() {
    const invalidDraft = {
        book: { name: '无关键词蓝灯' },
        entries: [
            {
                id: 'E01',
                title: '坏条目',
                light: WORLD_BOOK_CONTEXT_LIGHTS.BLUE,
                keywords: [],
                insertionOrder: 10,
                depth: 4,
                position: 'before_char',
                content: 'x'.repeat(100),
            },
        ],
    };

    const invalidResult = validateWorldBookGenerationDraft(invalidDraft, { requireContent: true });
    assert.equal(invalidResult.ok, false);
    assert.ok(invalidResult.errors.some(item => item.code === 'BLUE_LIGHT_KEYWORDS_REQUIRED'));

    const validDraft = {
        book: { name: '合法草稿' },
        entries: [
            {
                id: 'E01',
                title: '世界规则',
                light: WORLD_BOOK_CONTEXT_LIGHTS.BLUE,
                keywords: ['规则', '联邦'],
                insertionOrder: 10,
                depth: 4,
                position: 'before_char',
                content: '用于测试映射的合法内容。'.repeat(5),
            },
            {
                id: 'E02',
                title: '常驻设定',
                light: WORLD_BOOK_CONTEXT_LIGHTS.GREEN,
                keywords: [],
                insertionOrder: 20,
                depth: 4,
                position: 'before_char',
                content: '绿灯条目可以不设置关键词，但会直接进入上下文。'.repeat(4),
            },
        ],
    };

    const validResult = validateWorldBookGenerationDraft(validDraft, { requireContent: true });
    assert.equal(validResult.ok, true);

    const mapped = mapDraftEntriesToEditableEntries(validResult.normalized.entries);
    assert.equal(mapped.length, 2);
    assert.equal(mapped[0].selective, true, '蓝灯应映射为 selective=true');
    assert.equal(mapped[0].constant, false);
    assert.equal(mapped[1].constant, true, '绿灯应映射为 constant=true');
    assert.equal(mapped[1].selective, false);
    assert.equal(mapped[0].keysText, '规则, 联邦');
}

function testPatchSchemaAndApply() {
    const patchValidation = validatePatchInstruction({
        entryId: 'E01',
        scope: WORLD_BOOK_PATCH_SCOPE.PARAGRAPH,
        mode: WORLD_BOOK_PATCH_MODE.REPLACE,
        paragraphIndex: 1,
        replacement: '新的第二段内容。',
    });

    assert.equal(patchValidation.ok, true);

    const entry = {
        content: '第一段。\n\n第二段。\n\n第三段。',
    };

    const patched = applyLocalPatchToEntry(entry, patchValidation.normalized);
    assert.equal(patched.content, '第一段。\n\n新的第二段内容。\n\n第三段。');
}

function runAllTests() {
    console.log('🚀 开始运行世界书 AI 代写基础能力测试\n');

    testLightInferenceAndApply();
    console.log('✓ 蓝绿灯语义推断与映射正确');

    testSchemaRoundTrip();
    console.log('✓ 生成草稿 schema 紧凑格式往返正确');

    testValidatorAndMapping();
    console.log('✓ 草稿校验与编辑态映射正确');

    testPatchSchemaAndApply();
    console.log('✓ 局部改写 patch 结构与本地应用正确');

    console.log('\n✅ 世界书 AI 代写 M0/M1 测试通过');
}

runAllTests();
