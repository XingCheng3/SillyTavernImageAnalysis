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
    validateGenerationInput,
    validateWorldBookGenerationDraft,
} from '../src/utils/worldBookAIGenerationValidator.js';
import {
    WORLD_BOOK_PATCH_ACTION,
    WORLD_BOOK_PATCH_MODE,
    WORLD_BOOK_PATCH_SCOPE,
    applyLocalPatchToEntry,
    applyPatchOperationsToEntry,
    applyPatchOperationsToEntryWithReport,
    buildPatchPlanPreview,
    findWorldBookEntryIndex,
    getPatchTargetText,
    validatePatchInstruction,
    validatePatchPlan,
} from '../src/utils/worldBookAIPatchSchema.js';
import {
    TEXT_PATCH_ACTION,
    applyTextPatchOperation,
    applyTextPatchOperationsWithReport,
} from '../src/utils/structuredTextPatch.js';
import { buildLineDiff, summarizeLineDiff } from '../src/utils/textDiffPreview.js';

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

    const mapped = mapDraftEntriesToEditableEntries(validResult.normalized.entries, {
        startIndex: 7,
        startId: 20,
        startOrder: 90,
    });
    assert.equal(mapped.length, 2);
    assert.equal(mapped[0].selective, true, '蓝灯应映射为 selective=true');
    assert.equal(mapped[0].constant, false);
    assert.equal(mapped[1].constant, true, '绿灯应映射为 constant=true');
    assert.equal(mapped[1].selective, false);
    assert.equal(mapped[0].keysText, '规则, 联邦');
    assert.equal(mapped[0].id, 20);
    assert.equal(mapped[1].id, 21);
    assert.equal(mapped[0].insertion_order, 100);
    assert.equal(mapped[1].insertion_order, 110);
}

function testGenerationInputValidation() {
    const invalid = validateGenerationInput({
        premise: '测试',
        targetEntryCount: 12,
        openingCount: -1,
    });

    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some(item => item.code === 'OPENING_COUNT_INVALID'));

    const valid = validateGenerationInput({
        premise: '测试主线',
        targetEntryCount: 16,
        openingCount: 3,
    });

    assert.equal(valid.ok, true);
}

function testOpeningValidationRules() {
    const draft = {
        book: { name: '开场校验' },
        entries: [
            {
                id: 'E01',
                title: '主世界规则',
                light: WORLD_BOOK_CONTEXT_LIGHTS.GREEN,
                keywords: [],
                insertionOrder: 10,
                depth: 4,
                position: 'before_char',
                content: '这是合法正文。'.repeat(8),
            },
        ],
        openings: [
            {
                id: 'OP1',
                title: '开场A',
                text: '第一幕。',
                enableEntryIds: ['E01'],
                disableEntryIds: ['E01'],
            },
            {
                id: 'OP1',
                title: '开场B',
                text: '',
                enableEntryIds: [],
                disableEntryIds: [],
            },
        ],
    };

    const result = validateWorldBookGenerationDraft(draft, { requireContent: true });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(item => item.code === 'OPENING_ID_DUPLICATED'));
    assert.ok(result.errors.some(item => item.code === 'OPENING_ENTRY_CONFLICT'));
    assert.ok(result.warnings.some(item => item.code === 'OPENING_TEXT_EMPTY'));
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

function testPatchHelpers() {
    const entries = [
        { id: 5, content: 'A' },
        { id: 8, content: '第一段。\n\n第二段。' },
    ];

    assert.equal(findWorldBookEntryIndex(entries, '8'), 1);
    assert.equal(findWorldBookEntryIndex(entries, '404'), -1);

    const target = getPatchTargetText(entries[1], {
        scope: WORLD_BOOK_PATCH_SCOPE.PARAGRAPH,
        field: 'content',
        paragraphIndex: 1,
    });
    assert.equal(target, '第二段。');
}

function testStructuredTextPatchRequiresDisambiguation() {
    assert.throws(() => {
        applyTextPatchOperation('关键词A，关键词A，关键词A', {
            action: TEXT_PATCH_ACTION.REPLACE_TEXT,
            searchText: '关键词A',
            replacement: '关键词B',
        });
    }, /occurrence|anchors/);

    const patched = applyTextPatchOperation('关键词A，关键词A，关键词A', {
        action: TEXT_PATCH_ACTION.REPLACE_TEXT,
        searchText: '关键词A',
        replacement: '关键词B',
        occurrence: 2,
    });
    assert.equal(patched, '关键词A，关键词B，关键词A');
}

function testStructuredTextPatchReportIsolation() {
    const report = applyTextPatchOperationsWithReport('王城守卫极严。', [
        {
            opId: 'ok_1',
            action: TEXT_PATCH_ACTION.REPLACE_TEXT,
            searchText: '守卫极严',
            replacement: '守卫严密但可申请通行',
        },
        {
            opId: 'bad_2',
            action: TEXT_PATCH_ACTION.REPLACE_TEXT,
            searchText: '不存在的片段',
            replacement: '不会生效',
        },
        {
            opId: 'ok_3',
            action: TEXT_PATCH_ACTION.APPEND_AFTER_TEXT,
            searchText: '可申请通行',
            replacement: '，需持军令。',
        },
    ], { continueOnError: true });

    assert.equal(report.ok, false);
    assert.equal(report.successCount, 2);
    assert.equal(report.failedCount, 1);
    assert.equal(report.afterText.includes('需持军令'), true);
}

function testPatchPlanPreviewOperationFailureIsolation() {
    const entries = [
        {
            id: 11,
            name: '帝国军纪',
            content: '帝国军纪极严。\n\n任何越级行为都会被立即处决。',
        },
    ];

    const preview = buildPatchPlanPreview(entries, [
        {
            opId: 'op_ok',
            entryId: '11',
            field: 'content',
            action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
            searchText: '立即处决',
            replacement: '军法审议后判罚',
        },
        {
            opId: 'op_bad',
            entryId: '11',
            field: 'content',
            action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
            searchText: '不会命中的片段',
            replacement: '无效',
        },
    ]);

    assert.equal(preview.failedOperationCount, 1);
    assert.equal(preview.successOperationCount, 1);
    assert.equal(preview.entryPreviews[0].afterText.includes('军法审议后判罚'), true);
}

function testPatchPlanValidationAndPreview() {
    const entries = [
        {
            id: 11,
            name: '帝国军纪',
            keysText: '帝国, 军纪',
            content: '帝国军纪极严。\n\n任何越级行为都会被立即处决。',
        },
        {
            id: 12,
            name: '贵族特权',
            keysText: '帝国, 贵族',
            content: '帝国贵族拥有极高豁免权。',
        },
    ];

    const validation = validatePatchPlan({
        summary: '同步放宽军纪与贵族处罚描述',
        selectedEntryIds: ['11', '12'],
        operations: [
            {
                opId: 'op_1',
                entryId: '11',
                field: 'content',
                action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
                searchText: '立即处决',
                replacement: '视情节监禁',
            },
            {
                opId: 'op_2',
                entryId: '12',
                field: 'content',
                action: WORLD_BOOK_PATCH_ACTION.APPEND_AFTER_TEXT,
                searchText: '豁免权。',
                replacement: '\n但近年军法改革后，部分特权已被收回。',
            },
        ],
    }, {
        entries,
        focusEntryId: '11',
        allowRelatedEntries: true,
    });

    assert.equal(validation.ok, true);

    const preview = buildPatchPlanPreview(entries, validation.normalized.operations);
    assert.equal(preview.affectedEntryCount, 2);
    assert.equal(preview.operationCount, 2);
    assert.equal(preview.entryPreviews[0].afterText.includes('视情节监禁'), true);
    assert.equal(preview.entryPreviews[1].afterText.includes('部分特权已被收回'), true);
}

function testPatchOperationsApplyToEntry() {
    const entry = {
        id: 11,
        name: '帝国军纪',
        content: '帝国军纪极严。\n\n任何越级行为都会被立即处决。',
    };

    const nextEntry = applyPatchOperationsToEntry(entry, [
        {
            opId: 'op_1',
            entryId: '11',
            field: 'content',
            action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
            searchText: '极严',
            replacement: '更重视秩序但保留裁量',
        },
        {
            opId: 'op_2',
            entryId: '11',
            field: 'content',
            action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
            searchText: '立即处决',
            replacement: '军法审议后判罚',
        },
    ]);

    assert.equal(nextEntry.content.includes('更重视秩序但保留裁量'), true);
    assert.equal(nextEntry.content.includes('军法审议后判罚'), true);
}

function testPatchOperationsApplyWithReport() {
    const entry = {
        id: 21,
        content: 'A 段。\n\nB 段。',
    };

    const report = applyPatchOperationsToEntryWithReport(entry, [
        {
            opId: 'op_ok',
            entryId: '21',
            field: 'content',
            action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
            searchText: 'B 段',
            replacement: 'B 段（已修订）',
        },
        {
            opId: 'op_bad',
            entryId: '21',
            field: 'content',
            action: WORLD_BOOK_PATCH_ACTION.REPLACE_TEXT,
            searchText: '不存在片段',
            replacement: '不会应用',
        },
    ], { continueOnError: true });

    assert.equal(report.ok, false);
    assert.equal(report.successCount, 1);
    assert.equal(report.failedCount, 1);
    assert.equal(report.entry.content.includes('B 段（已修订）'), true);
}

function testLineDiffPreview() {
    const diff = buildLineDiff('第一行\n第二行\n第三行', '第一行\n第二行(改)\n第三行\n第四行');
    const summary = summarizeLineDiff(diff);

    assert.ok(summary.add >= 1, '应识别新增行');
    assert.ok(summary.remove >= 1, '应识别删除行');
    assert.ok(summary.context >= 1, '应识别相同行');
}

function runAllTests() {
    console.log('🚀 开始运行世界书 AI 代写基础能力测试\n');

    testLightInferenceAndApply();
    console.log('✓ 蓝绿灯语义推断与映射正确');

    testSchemaRoundTrip();
    console.log('✓ 生成草稿 schema 紧凑格式往返正确');

    testValidatorAndMapping();
    console.log('✓ 草稿校验与编辑态映射正确');

    testGenerationInputValidation();
    console.log('✓ 生成输入校验正确');

    testOpeningValidationRules();
    console.log('✓ 开场分支规则校验正确');

    testPatchSchemaAndApply();
    console.log('✓ 局部改写 patch 结构与本地应用正确');

    testPatchHelpers();
    console.log('✓ 局部改写辅助能力正确');

    testStructuredTextPatchRequiresDisambiguation();
    console.log('✓ 最小文本 patch 歧义保护正确');

    testStructuredTextPatchReportIsolation();
    console.log('✓ 文本 patch 支持按 operation 隔离失败');

    testPatchPlanPreviewOperationFailureIsolation();
    console.log('✓ patch 预览可隔离失败 operation 并保留成功结果');

    testPatchPlanValidationAndPreview();
    console.log('✓ 多条目 patch plan 校验与预览正确');

    testPatchOperationsApplyToEntry();
    console.log('✓ 多 operation 顺序应用正确');

    testPatchOperationsApplyWithReport();
    console.log('✓ 条目应用支持部分成功 + 失败报告');

    testLineDiffPreview();
    console.log('✓ 行级差异预览能力正确');

    console.log('\n✅ 世界书 AI 代写 M0/M1/M2/M3/M4 基础测试通过');
}

runAllTests();
