import assert from 'node:assert/strict';
import {
    buildWorldBookPatchPlannerUserPrompt,
    createWorldBookPatchPlannerResult,
    validateWorldBookPatchPlannerResult,
} from '../src/utils/worldBookAIPatchPlanner.js';
import { validatePatchPlan } from '../src/utils/worldBookAIPatchSchema.js';
import { extractJsonText, parseJsonObjectResponse } from '../src/utils/worldBookAIPatchResponse.js';

function testPlannerResultNormalization() {
    const result = createWorldBookPatchPlannerResult({
        summary: '同步修订帝国军纪相关条目',
        selectedEntryIds: ['11', '12', '11'],
        targets: [
            { entryId: '11', reason: '主条目' },
            { entryId: '12', reason: '关联贵族规则' },
        ],
    });

    assert.deepEqual(result.selectedEntryIds, ['11', '12']);
    assert.equal(result.targets.length, 2);
}

function testPlannerValidationGuards() {
    const entries = [
        { id: 11, name: '帝国军纪' },
        { id: 12, name: '贵族特权' },
        { id: 13, name: '军法改革' },
    ];

    const okResult = validateWorldBookPatchPlannerResult({
        summary: '联动修改',
        selectedEntryIds: ['12', '13'],
        targets: [
            { entryId: '12', reason: '贵族特权会受影响' },
            { entryId: '13', reason: '军法改革条目要同步' },
        ],
    }, {
        entries,
        focusEntryId: '11',
        allowRelatedEntries: true,
        maxAffectedEntries: 4,
    });

    assert.equal(okResult.ok, true);
    assert.deepEqual(okResult.normalized.selectedEntryIds, ['11', '12', '13']);

    const lockedResult = validateWorldBookPatchPlannerResult({
        summary: '不允许联动时应只保留 focus',
        selectedEntryIds: ['12', '13'],
        targets: [
            { entryId: '12', reason: '不应保留' },
        ],
    }, {
        entries,
        focusEntryId: '11',
        allowRelatedEntries: false,
        maxAffectedEntries: 4,
    });

    assert.equal(lockedResult.ok, true);
    assert.deepEqual(lockedResult.normalized.selectedEntryIds, ['11']);
    assert.equal(lockedResult.normalized.targets.length, 0);
}

function testPlannerPromptIncludesCatalogAndFocus() {
    const prompt = buildWorldBookPatchPlannerUserPrompt({
        entries: [
            { id: 11, name: '帝国军纪', keysText: '帝国, 军纪', content: '帝国军纪极严。' },
            { id: 12, name: '贵族特权', keysText: '帝国, 贵族', content: '贵族拥有部分豁免权。' },
        ],
        focusEntry: { id: 11, name: '帝国军纪', keysText: '帝国, 军纪', content: '帝国军纪极严。' },
        patch: {
            entryId: '11',
            instruction: '把帝国军纪改宽松一些，并同步相关条目。',
            scope: 'entry',
            mode: 'rewrite',
            field: 'content',
            keepStyle: true,
        },
        maxAffectedEntries: 6,
    });

    assert.equal(prompt.includes('focusEntryId'), true);
    assert.equal(prompt.includes('帝国军纪'), true);
    assert.equal(prompt.includes('贵族特权'), true);
}

function testJsonExtractionParsesFencedResponse() {
    const raw = '```json\n{"summary":"ok","selectedEntryIds":["11"]}\n```';
    const jsonText = extractJsonText(raw);
    assert.equal(jsonText.includes('selectedEntryIds'), true);

    const parsed = parseJsonObjectResponse(raw);
    assert.equal(parsed.summary, 'ok');
}

function testPatchPlanRespectsConfirmedPlannerSelection() {
    const result = validatePatchPlan({
        summary: '非法跨条目修改',
        operations: [
            {
                opId: 'op_1',
                entryId: '12',
                field: 'content',
                action: 'replace_whole',
                replacement: '新的内容',
            },
        ],
    }, {
        entries: [
            { id: 11, name: '帝国军纪' },
            { id: 12, name: '贵族特权' },
        ],
        focusEntryId: '11',
        allowRelatedEntries: true,
        allowedEntryIds: ['11'],
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors.some(item => item.code === 'PATCH_OPERATION_ENTRY_NOT_SELECTED'), true);
}

function runAllTests() {
    console.log('🚀 开始运行世界书 AI patch planner 测试\n');

    testPlannerResultNormalization();
    console.log('✓ planner 结果归一化正确');

    testPlannerValidationGuards();
    console.log('✓ planner 约束校验正确');

    testPlannerPromptIncludesCatalogAndFocus();
    console.log('✓ planner prompt 包含目录与 focus 条目信息');

    testJsonExtractionParsesFencedResponse();
    console.log('✓ patch 响应 JSON 提取正确');

    testPatchPlanRespectsConfirmedPlannerSelection();
    console.log('✓ patch plan 会遵守已确认的 planner 条目选择');

    console.log('\n✅ 世界书 AI patch planner 测试通过');
}

runAllTests();
