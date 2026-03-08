import assert from 'node:assert/strict';
import CharacterCardParser, {
    CharacterCardUtils,
    SUPPORTED_SPECS,
    normalizeCharacterData,
} from '../src/utils/characterCardParser.js';

const mockV2CharacterData = {
    spec: SUPPORTED_SPECS.V2,
    spec_version: '2.0',
    data: {
        name: '测试角色V2',
        description: '这是一个V2格式的测试角色',
        personality: '聪明、有趣',
        scenario: '在一个现代办公室中',
        first_mes: '嗨！我是V2测试角色。',
        mes_example: '{{user}}: 测试\n{{char}}: 收到测试信号！',
        alternate_greetings: ['另一种问候方式'],
        character_book: {
            name: '测试世界书',
            description: '用于测试的世界书',
            scan_depth: 5,
            token_budget: 2048,
            entries: [
                {
                    id: 0,
                    keys: ['办公室', '工作'],
                    secondary_keys: [],
                    comment: '工作环境',
                    content: '这是一个现代化的办公室环境。',
                    constant: false,
                    selective: false,
                    insertion_order: 0,
                    enabled: true,
                    position: 'after_char',
                    extensions: {
                        position: 1,
                        depth: 4,
                        display_index: 0,
                        probability: 100,
                        useProbability: true,
                    },
                },
            ],
        },
    },
};

const mockV3CharacterData = {
    spec: SUPPORTED_SPECS.V3,
    spec_version: '3.0',
    data: {
        name: '测试角色V3',
        description: '这是一个V3格式的测试角色',
        personality: '创新、前瞻',
        scenario: '在一个未来世界中',
        greetings: ['你好，未来的朋友！', '欢迎来到V3世界'],
        lore: [
            {
                id: 0,
                name: '未来设定',
                comment: '未来设定',
                keys: ['未来', '科技'],
                secondary_keys: ['赛博'],
                content: '这是一个高科技的未来世界。',
                enabled: true,
                insertion_order: 0,
                position: 'after_char',
                extensions: {
                    depth: 5,
                    probability: 90,
                    useProbability: true,
                    case_sensitive: false,
                },
            },
        ],
    },
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

async function roundTrip(characterData) {
    const pngData = CharacterCardUtils.exportToPNG(characterData);
    assert.ok(pngData instanceof Uint8Array, '导出结果应为 Uint8Array');
    return await CharacterCardParser.parseFromBuffer(pngData.buffer);
}

function testNormalizationCreatesCharacterBookFromV3Lore() {
    const normalized = normalizeCharacterData(mockV3CharacterData);
    assert.equal(normalized.spec, SUPPORTED_SPECS.V3);
    assert.ok(Array.isArray(normalized.data.lore));
    assert.ok(normalized.data.character_book, 'V3 lore 应同步生成 character_book');
    assert.equal(normalized.data.character_book.entries.length, 1);
    assert.equal(normalized.data.character_book.entries[0].comment, '未来设定');
}

async function testV3LoreRoundTrip() {
    const card = normalizeCharacterData(mockV3CharacterData);
    card.data.book_entries = [
        {
            id: 7,
            name: '新的世界书条目',
            comment: '新的世界书条目',
            keys: ['新关键词'],
            secondary_keys: ['副关键词'],
            content: '新内容',
            enabled: true,
            constant: false,
            selective: false,
            insertion_order: 3,
            position: 'before_char',
            probability: 0,
            depth: 0,
            scanDepth: 0,
            caseSensitive: false,
            extensions: {
                probability: 0,
                depth: 0,
                scan_depth: 0,
                case_sensitive: false,
            },
        },
    ];

    const parsed = await roundTrip(card);
    const lore = parsed.data.data.lore;
    const bookEntries = parsed.data.data.character_book.entries;

    assert.equal(lore.length, 1, 'V3 lore 应回写为最新编辑结果');
    assert.equal(bookEntries.length, 1, 'character_book.entries 应同步更新');
    assert.equal(lore[0].comment, '新的世界书条目');
    assert.equal(lore[0].content, '新内容');
    assert.equal(lore[0].position, 'before_char');
    assert.equal(lore[0].extensions.probability, 0, 'probability=0 不能被覆盖');
    assert.equal(lore[0].extensions.depth, 0, 'depth=0 不能被覆盖');
    assert.equal(lore[0].extensions.scan_depth, 0, 'scan_depth=0 不能被覆盖');
    assert.equal(lore[0].extensions.case_sensitive, false, 'case_sensitive=false 不能被覆盖');
    assert.equal(bookEntries[0].extensions.probability, 0);
    assert.equal(bookEntries[0].extensions.depth, 0);
    assert.equal(bookEntries[0].extensions.scan_depth, 0);
    assert.equal(bookEntries[0].extensions.case_sensitive, false);
}

async function testDeletingAllWorldbookEntriesPersists() {
    const card = normalizeCharacterData(mockV3CharacterData);
    card.data.book_entries = [];

    const parsed = await roundTrip(card);
    assert.deepEqual(parsed.data.data.lore, [], '删空后 lore 应为空数组');
    assert.deepEqual(parsed.data.data.character_book.entries, [], '删空后 character_book.entries 应为空数组');
}

async function testV2RoundTripKeepsCharacterBook() {
    const card = normalizeCharacterData(mockV2CharacterData);
    card.data.book_entries = [
        {
            id: 2,
            comment: '更新后的环境',
            keys: ['办公室', '升级'],
            secondary_keys: [],
            content: '更新后的办公室环境。',
            enabled: true,
            insertion_order: 2,
            position: 'after_char',
            probability: 0,
            depth: 0,
            scanDepth: 0,
            caseSensitive: false,
            extensions: {
                probability: 0,
                depth: 0,
                scan_depth: 0,
                case_sensitive: false,
            },
        },
    ];

    const parsed = await roundTrip(card);
    const entries = parsed.data.data.character_book.entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].comment, '更新后的环境');
    assert.equal(entries[0].extensions.probability, 0);
    assert.equal(entries[0].extensions.depth, 0);
    assert.equal(entries[0].extensions.scan_depth, 0);
    assert.equal(entries[0].extensions.case_sensitive, false);
    assert.equal(parsed.data.data.lore, undefined, 'V2 导出不应带 lore');
}

async function testJsonImportRoundTrip() {
    const parsed = CharacterCardUtils.parseJson(JSON.stringify(clone(mockV3CharacterData)));
    assert.equal(parsed.success, true);
    assert.equal(parsed.metadata.sourceType, 'json');
    assert.ok(parsed.data.data.character_book, 'JSON 导入后应得到统一 worldbook 结构');

    const roundTripped = await roundTrip(parsed.data);
    assert.equal(roundTripped.data.data.greetings[0], '你好，未来的朋友！');
    assert.equal(roundTripped.data.data.mes_example ?? '', '');
}

async function testExtendedWorldbookFieldsRoundTrip() {
    const card = normalizeCharacterData(mockV3CharacterData);
    card.data.book_entries = [
        {
            id: 99,
            name: '扩展字段条目',
            comment: '扩展字段条目',
            keys: ['扩展'],
            secondary_keys: ['字段'],
            content: '测试扩展字段',
            enabled: true,
            insertion_order: 8,
            position: 'after_char',
            triggers: ['chat_start', 'group_message'],
            ignoreBudget: true,
            matchPersonaDescription: true,
            matchCharacterDescription: true,
            matchCharacterPersonality: false,
            matchCharacterDepthPrompt: true,
            matchScenario: true,
            matchCreatorNotes: false,
            extensions: {
                display_index: 3,
                probability: 50,
                depth: 2,
                match_persona_description: true,
                match_character_description: true,
                match_character_personality: false,
                match_character_depth_prompt: true,
                match_scenario: true,
                match_creator_notes: false,
                triggers: ['chat_start', 'group_message'],
                ignore_budget: true,
            },
        },
    ];

    const parsed = await roundTrip(card);
    const loreEntry = parsed.data.data.lore[0];
    const bookEntry = parsed.data.data.character_book.entries[0];

    assert.deepEqual(loreEntry.extensions.triggers, ['chat_start', 'group_message']);
    assert.equal(loreEntry.extensions.ignore_budget, true);
    assert.equal(loreEntry.extensions.match_persona_description, true);
    assert.equal(loreEntry.extensions.match_character_description, true);
    assert.equal(loreEntry.extensions.match_character_depth_prompt, true);
    assert.equal(loreEntry.extensions.match_scenario, true);
    assert.equal(bookEntry.extensions.ignore_budget, true);
    assert.deepEqual(bookEntry.extensions.triggers, ['chat_start', 'group_message']);
}

async function runAllTests() {
    console.log('🚀 开始运行 CharacterCardParser P0 回归测试\n');

    testNormalizationCreatesCharacterBookFromV3Lore();
    console.log('✓ V3 lore 标准化为 character_book');

    await testV3LoreRoundTrip();
    console.log('✓ V3 lore round-trip 正确');

    await testDeletingAllWorldbookEntriesPersists();
    console.log('✓ 删空世界书条目可正确持久化');

    await testV2RoundTripKeepsCharacterBook();
    console.log('✓ V2 round-trip 保持 character_book');

    await testJsonImportRoundTrip();
    console.log('✓ JSON 导入可接入统一闭环');

    await testExtendedWorldbookFieldsRoundTrip();
    console.log('✓ 世界书扩展字段 round-trip 正确');

    console.log('\n✅ 全部 P0/P1 回归测试通过');
}

runAllTests().catch((error) => {
    console.error('\n❌ 测试失败');
    console.error(error);
    process.exit(1);
});
