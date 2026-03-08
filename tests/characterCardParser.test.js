 /**
 * CharacterCardParser 测试文件
 * 验证角色卡解析器的各种功能
 */

import CharacterCardParser, { 
    CharacterCardUtils, 
    SUPPORTED_SPECS,
    isValidCharacterData,
    normalizeCharacterData 
} from '../src/utils/characterCardParser.js';

// ========== 测试数据 ==========

const mockV1CharacterData = {
    name: "测试角色V1",
    description: "这是一个测试角色",
    personality: "友善、乐于助人",
    scenario: "在一个测试环境中",
    first_mes: "你好！我是测试角色。",
    mes_example: "{{user}}: 你好\n{{char}}: 你好！很高兴见到你！"
};

const mockV2CharacterData = {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
        name: "测试角色V2",
        description: "这是一个V2格式的测试角色",
        personality: "聪明、有趣",
        scenario: "在一个现代办公室中",
        first_mes: "嗨！我是V2测试角色。",
        mes_example: "{{user}}: 测试\n{{char}}: 收到测试信号！",
        alternate_greetings: ["另一种问候方式"],
        character_book: {
            name: "测试世界书",
            description: "用于测试的世界书",
            scan_depth: 5,
            token_budget: 2048,
            entries: [
                {
                    id: 0,
                    keys: ["办公室", "工作"],
                    secondary_keys: [],
                    comment: "工作环境",
                    content: "这是一个现代化的办公室环境。",
                    constant: false,
                    selective: false,
                    insertion_order: 0,
                    enabled: true,
                    position: "after_char",
                    extensions: {
                        position: 1,
                        depth: 4,
                        display_index: 0,
                        probability: 100,
                        useProbability: true
                    }
                }
            ]
        }
    }
};

const mockV3CharacterData = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
        name: "测试角色V3",
        description: "这是一个V3格式的测试角色",
        personality: "创新、前瞻",
        scenario: "在一个未来世界中",
        greetings: ["你好，未来的朋友！", "欢迎来到V3世界"],
        lore: [
            {
                name: "未来设定",
                keys: ["未来", "科技"],
                content: "这是一个高科技的未来世界。",
                enabled: true,
                extensions: {
                    depth: 5,
                    probability: 90
                }
            }
        ]
    }
};

// ========== 单元测试函数 ==========

/**
 * 测试数据验证功能
 */
function testDataValidation() {
    console.log("🧪 测试数据验证功能...");
    
    // 测试有效数据
    const validTests = [
        { data: mockV1CharacterData, name: "V1格式" },
        { data: mockV2CharacterData, name: "V2格式" },
        { data: mockV3CharacterData, name: "V3格式" }
    ];
    
    validTests.forEach(test => {
        const isValid = isValidCharacterData(test.data);
        console.log(`  ✓ ${test.name} 验证: ${isValid ? '通过' : '失败'}`);
        
        if (isValid) {
            const validation = CharacterCardUtils.validate(test.data);
            console.log(`    详细验证: ${validation.valid ? '通过' : '失败'}`);
            if (validation.warnings.length > 0) {
                console.log(`    警告: ${validation.warnings.join(', ')}`);
            }
        }
    });
    
    // 测试无效数据
    const invalidTests = [
        { data: null, name: "空数据" },
        { data: {}, name: "空对象" },
        { data: { description: "只有描述" }, name: "缺少名称" }
    ];
    
    invalidTests.forEach(test => {
        const isValid = isValidCharacterData(test.data);
        console.log(`  ✓ ${test.name} 验证: ${isValid ? '失败(应该无效)' : '通过'}`);
    });
}

/**
 * 测试数据标准化功能
 */
function testDataNormalization() {
    console.log("\n🧪 测试数据标准化功能...");
    
    try {
        // 测试V1数据标准化
        const normalizedV1 = normalizeCharacterData(mockV1CharacterData);
        console.log(`  ✓ V1标准化: ${normalizedV1.spec ? '成功' : '失败'}`);
        console.log(`    检测到的规格: ${normalizedV1.spec}`);
        
        // 测试V2数据标准化
        const normalizedV2 = normalizeCharacterData(mockV2CharacterData);
        console.log(`  ✓ V2标准化: ${normalizedV2.spec === SUPPORTED_SPECS.V2 ? '成功' : '失败'}`);
        
        // 测试V3数据标准化
        const normalizedV3 = normalizeCharacterData(mockV3CharacterData);
        console.log(`  ✓ V3标准化: ${normalizedV3.spec === SUPPORTED_SPECS.V3 ? '成功' : '失败'}`);
        
        // 测试兼容性字段映射
        const v1WithOldFields = {
            ...mockV1CharacterData,
            first_mes: "旧格式的首次问候",
            mes_example: "旧格式的示例对话"
        };
        
        const normalized = normalizeCharacterData(v1WithOldFields);
        const hasMapping = normalized.data.first_message === "旧格式的首次问候" && 
                          normalized.data.message_example === "旧格式的示例对话";
        console.log(`  ✓ 兼容性字段映射: ${hasMapping ? '成功' : '失败'}`);
        
    } catch (error) {
        console.log(`  ✗ 标准化测试失败: ${error.message}`);
    }
}

/**
 * 测试模板创建功能
 */
function testTemplateCreation() {
    console.log("\n🧪 测试模板创建功能...");
    
    try {
        const template = CharacterCardUtils.createTemplate("测试角色");
        
        const hasRequiredFields = template.data.name === "测试角色" &&
                                 template.spec &&
                                 template.data.character_book;
        
        console.log(`  ✓ 模板创建: ${hasRequiredFields ? '成功' : '失败'}`);
        console.log(`    角色名称: ${template.data.name}`);
        console.log(`    规格版本: ${template.spec}`);
        console.log(`    包含世界书: ${!!template.data.character_book}`);
        
        // 验证创建的模板
        const validation = CharacterCardUtils.validate(template);
        console.log(`  ✓ 模板验证: ${validation.valid ? '通过' : '失败'}`);
        
    } catch (error) {
        console.log(`  ✗ 模板创建失败: ${error.message}`);
    }
}

/**
 * 测试PNG导出功能（不实际创建文件）
 */
function testPNGExport() {
    console.log("\n🧪 测试PNG导出功能...");
    
    try {
        // 测试导出V2格式
        const pngDataV2 = CharacterCardUtils.exportToPNG(mockV2CharacterData);
        console.log(`  ✓ V2导出: ${pngDataV2 instanceof Uint8Array ? '成功' : '失败'}`);
        console.log(`    PNG大小: ${pngDataV2.length} 字节`);
        
        // 测试导出V3格式
        const pngDataV3 = CharacterCardUtils.exportToPNG(mockV3CharacterData);
        console.log(`  ✓ V3导出: ${pngDataV3 instanceof Uint8Array ? '成功' : '失败'}`);
        console.log(`    PNG大小: ${pngDataV3.length} 字节`);
        
        // 验证PNG文件头
        const isPngValid = pngDataV2[0] === 0x89 && 
                          pngDataV2[1] === 0x50 && 
                          pngDataV2[2] === 0x4E && 
                          pngDataV2[3] === 0x47;
        console.log(`  ✓ PNG文件头验证: ${isPngValid ? '通过' : '失败'}`);
        
    } catch (error) {
        console.log(`  ✗ PNG导出失败: ${error.message}`);
    }
}

/**
 * 测试世界书处理功能
 */
function testWorldBookHandling() {
    console.log("\n🧪 测试世界书处理功能...");
    
    try {
        // 创建包含复杂世界书的角色卡
        const complexCharacter = CharacterCardUtils.createTemplate("复杂角色");
        
        // 添加多个世界书条目
        const entries = [
            {
                id: 0,
                keys: ["城市", "都市"],
                secondary_keys: ["metropolis"],
                comment: "城市环境",
                content: "这是一个繁华的现代都市。",
                enabled: true,
                priority: 10,
                position: "after_char",
                extensions: {
                    depth: 5,
                    probability: 95,
                    group: "环境",
                    group_weight: 200
                }
            },
            {
                id: 1,
                keys: ["科技", "技术"],
                secondary_keys: ["technology"],
                comment: "科技设定",
                content: "拥有先进的人工智能技术。",
                enabled: true,
                priority: 8,
                position: "before_char",
                extensions: {
                    depth: 3,
                    probability: 80,
                    group: "背景",
                    group_weight: 150
                }
            }
        ];
        
        complexCharacter.data.character_book.entries = entries;
        
        // 测试导出和数据完整性
        const pngData = CharacterCardUtils.exportToPNG(complexCharacter);
        console.log(`  ✓ 复杂世界书导出: ${pngData instanceof Uint8Array ? '成功' : '失败'}`);
        
        // 验证世界书条目数量
        const entriesCount = complexCharacter.data.character_book.entries.length;
        console.log(`  ✓ 世界书条目数量: ${entriesCount === 2 ? '正确' : '错误'} (${entriesCount})`);
        
        // 验证扩展字段保存
        const firstEntry = complexCharacter.data.character_book.entries[0];
        const hasExtensions = firstEntry.extensions && 
                             firstEntry.extensions.depth === 5 &&
                             firstEntry.extensions.group === "环境";
        console.log(`  ✓ 扩展字段保存: ${hasExtensions ? '成功' : '失败'}`);
        
    } catch (error) {
        console.log(`  ✗ 世界书处理失败: ${error.message}`);
    }
}

/**
 * 测试边界情况
 */
function testEdgeCases() {
    console.log("\n🧪 测试边界情况...");
    
    try {
        // 测试空字符串字段
        const emptyFields = {
            name: "",
            description: "",
            personality: "",
            scenario: "",
            first_mes: ""
        };
        
        const validation1 = CharacterCardUtils.validate(emptyFields);
        console.log(`  ✓ 空字段处理: ${validation1.errors.length > 0 ? '正确检测' : '检测失败'}`);
        
        // 测试超长文本
        const longText = "很长的文本".repeat(1000);
        const longTextCharacter = {
            name: "长文本测试",
            description: longText,
            personality: longText
        };
        
        try {
            const pngData = CharacterCardUtils.exportToPNG(longTextCharacter);
            console.log(`  ✓ 长文本处理: ${pngData.length > 0 ? '成功' : '失败'}`);
        } catch (error) {
            console.log(`  ✗ 长文本处理失败: ${error.message}`);
        }
        
        // 测试特殊字符
        const specialChars = {
            name: "特殊字符测试 🎭",
            description: "包含特殊字符: ♠♣♥♦ αβγδ 中文测试",
            personality: "emoji测试: 😀😁😂🤣😃"
        };
        
        try {
            const pngData = CharacterCardUtils.exportToPNG(specialChars);
            console.log(`  ✓ 特殊字符处理: ${pngData.length > 0 ? '成功' : '失败'}`);
        } catch (error) {
            console.log(`  ✗ 特殊字符处理失败: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`  ✗ 边界情况测试失败: ${error.message}`);
    }
}

/**
 * 性能测试
 */
function testPerformance() {
    console.log("\n🧪 性能测试...");
    
    try {
        const iterations = 100;
        
        // 测试解析性能
        console.time("数据标准化性能");
        for (let i = 0; i < iterations; i++) {
            normalizeCharacterData(mockV2CharacterData);
        }
        console.timeEnd("数据标准化性能");
        
        // 测试导出性能
        console.time("PNG导出性能");
        for (let i = 0; i < 10; i++) { // 减少迭代次数，因为PNG导出比较重
            CharacterCardUtils.exportToPNG(mockV2CharacterData);
        }
        console.timeEnd("PNG导出性能");
        
        // 测试验证性能
        console.time("数据验证性能");
        for (let i = 0; i < iterations; i++) {
            CharacterCardUtils.validate(mockV2CharacterData);
        }
        console.timeEnd("数据验证性能");
        
        console.log("  ✓ 性能测试完成");
        
    } catch (error) {
        console.log(`  ✗ 性能测试失败: ${error.message}`);
    }
}

/**
 * 集成测试 - 完整的导出导入流程
 */
function testIntegration() {
    console.log("\n🧪 集成测试 - 完整流程...");
    
    try {
        // 1. 创建角色卡
        const originalCharacter = CharacterCardUtils.createTemplate("集成测试角色");
        originalCharacter.data.description = "这是一个集成测试角色";
        originalCharacter.data.personality = "测试用的性格";
        
        // 添加世界书条目
        originalCharacter.data.character_book.entries.push({
            id: 0,
            keys: ["测试", "集成"],
            comment: "集成测试条目",
            content: "这是一个集成测试的世界书条目。",
            enabled: true,
            insertion_order: 0,
            position: "after_char",
            extensions: {
                depth: 4,
                probability: 100
            }
        });
        
        console.log("  ✓ 步骤1: 创建角色卡");
        
        // 2. 导出为PNG
        const pngData = CharacterCardUtils.exportToPNG(originalCharacter);
        console.log("  ✓ 步骤2: 导出PNG");
        
        // 3. 模拟从PNG解析（在真实环境中这需要文件操作）
        // 这里我们验证PNG数据的基本结构
        const isPngValid = pngData[0] === 0x89 && 
                          pngData[1] === 0x50 && 
                          pngData[2] === 0x4E && 
                          pngData[3] === 0x47;
        
        if (isPngValid) {
            console.log("  ✓ 步骤3: PNG格式验证通过");
            
            // 4. 验证数据完整性
            const validation = CharacterCardUtils.validate(originalCharacter);
            if (validation.valid) {
                console.log("  ✓ 步骤4: 数据完整性验证通过");
                console.log("  🎉 集成测试全部通过！");
            } else {
                console.log("  ✗ 步骤4: 数据完整性验证失败");
                console.log("    错误:", validation.errors);
            }
        } else {
            console.log("  ✗ 步骤3: PNG格式验证失败");
        }
        
    } catch (error) {
        console.log(`  ✗ 集成测试失败: ${error.message}`);
    }
}

// ========== 运行所有测试 ==========

/**
 * 运行完整的测试套件
 */
function runAllTests() {
    console.log("🚀 开始运行 CharacterCardParser 测试套件\n");
    
    const startTime = Date.now();
    
    try {
        testDataValidation();
        testDataNormalization();
        testTemplateCreation();
        testPNGExport();
        testWorldBookHandling();
        testEdgeCases();
        testPerformance();
        testIntegration();
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`\n✅ 测试套件完成！总耗时: ${duration}ms`);
        console.log("📊 如果所有测试都显示'成功'或'通过'，说明模块工作正常。");
        
    } catch (error) {
        console.error(`\n❌ 测试套件执行失败: ${error.message}`);
        console.error(error.stack);
    }
}

// ========== 浏览器环境测试 ==========

/**
 * 在浏览器中运行的测试
 */
function runBrowserTests() {
    if (typeof window !== 'undefined') {
        console.log("🌐 浏览器环境检测到，运行浏览器特定测试...");
        
        // 测试文件API是否可用
        if (window.File && window.FileReader) {
            console.log("  ✓ 文件API可用");
        } else {
            console.log("  ✗ 文件API不可用");
        }
        
        // 测试下载功能
        try {
            const testData = new Uint8Array([1, 2, 3, 4]);
            const blob = new Blob([testData]);
            const url = URL.createObjectURL(blob);
            URL.revokeObjectURL(url);
            console.log("  ✓ Blob和URL API可用");
        } catch (error) {
            console.log("  ✗ Blob和URL API测试失败");
        }
    }
}

// ========== 导出测试函数 ==========

// Node.js环境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testDataValidation,
        testDataNormalization,
        testTemplateCreation,
        testPNGExport,
        testWorldBookHandling,
        testEdgeCases,
        testPerformance,
        testIntegration,
        runBrowserTests
    };
}

// 浏览器环境
if (typeof window !== 'undefined') {
    window.CharacterCardParserTests = {
        runAllTests,
        runBrowserTests
    };
    
    // 自动运行浏览器测试
    runBrowserTests();
}

// 自动运行测试（如果是直接执行）
if (typeof require !== 'undefined' && require.main === module) {
    runAllTests();
}