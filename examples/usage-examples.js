 /**
 * CharacterCardParser 使用示例
 * 演示如何在任何项目中使用角色卡解析与导出功能
 */

import CharacterCardParser, { CharacterCardUtils } from '../src/utils/characterCardParser.js';

// ========== 基础使用示例 ==========

/**
 * 示例1: 从文件解析角色卡
 */
async function parseCharacterCardFromFile() {
    // 假设从 input[type="file"] 获取文件
    const fileInput = document.getElementById('character-file');
    const file = fileInput.files[0];
    
    try {
        // 解析角色卡
        const result = await CharacterCardUtils.parseFile(file);
        
        if (result.success) {
            console.log('角色名称:', result.data.data.name);
            console.log('角色描述:', result.data.data.description);
            console.log('规格版本:', result.metadata.version);
            console.log('包含世界书:', result.metadata.hasWorldBook);
            
            // 获取世界书信息
            if (result.metadata.hasWorldBook) {
                const worldBook = result.data.data.character_book;
                console.log('世界书名称:', worldBook.name);
                console.log('世界书条目数量:', worldBook.entries.length);
            }
            
            return result.data;
        }
    } catch (error) {
        console.error('解析失败:', error.message);
    }
}

/**
 * 示例2: 从Base64字符串解析角色卡
 */
async function parseCharacterCardFromBase64() {
    const base64String = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."; // PNG的Base64
    
    try {
        const result = await CharacterCardUtils.parseBase64(base64String);
        
        if (result.success) {
            console.log('解析成功:', result.data.data.name);
            return result.data;
        }
    } catch (error) {
        console.error('Base64解析失败:', error.message);
    }
}

/**
 * 示例3: 创建新的角色卡
 */
function createNewCharacterCard() {
    // 创建基础模板
    const characterCard = CharacterCardUtils.createTemplate('小明');
    
    // 自定义角色信息
    characterCard.data.description = '一个友善的AI助手';
    characterCard.data.personality = '乐观、好学、乐于助人';
    characterCard.data.scenario = '在一个现代的办公环境中工作';
    characterCard.data.first_mes = '你好！我是小明，很高兴认识你！';
    
    // 添加世界书条目
    characterCard.data.character_book.entries.push({
        id: 0,
        keys: ['办公室', '工作'],
        secondary_keys: [],
        comment: '工作环境',
        content: '这是一个现代化的办公室，配备了最新的技术设备。',
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
            useProbability: true
        }
    });
    
    console.log('创建的角色卡:', characterCard);
    return characterCard;
}

/**
 * 示例4: 导出角色卡为PNG
 */
async function exportCharacterCard() {
    // 获取或创建角色卡数据
    const characterCard = createNewCharacterCard();
    
    try {
        // 导出为PNG
        const pngData = CharacterCardUtils.exportToPNG(characterCard);
        
        // 下载文件
        CharacterCardUtils.downloadPNG(pngData, '小明_角色卡.png');
        
        console.log('导出成功!');
    } catch (error) {
        console.error('导出失败:', error.message);
    }
}

/**
 * 示例5: 验证角色卡数据
 */
function validateCharacterCard(characterData) {
    const validation = CharacterCardUtils.validate(characterData);
    
    if (validation.valid) {
        console.log('角色卡数据有效 ✓');
    } else {
        console.log('角色卡数据无效 ✗');
        console.log('错误:', validation.errors);
    }
    
    if (validation.warnings.length > 0) {
        console.log('警告:', validation.warnings);
    }
    
    return validation;
}

// ========== 高级使用示例 ==========

/**
 * 示例6: 批量处理角色卡文件
 */
async function batchProcessCharacterCards(files) {
    const results = [];
    
    for (const file of files) {
        try {
            const result = await CharacterCardUtils.parseFile(file);
            
            if (result.success) {
                // 提取关键信息
                const info = {
                    filename: file.name,
                    characterName: result.data.data.name,
                    version: result.metadata.version,
                    hasWorldBook: result.metadata.hasWorldBook,
                    worldBookEntries: result.data.data.character_book?.entries?.length || 0
                };
                
                results.push(info);
                console.log(`处理完成: ${info.characterName}`);
            }
        } catch (error) {
            console.error(`处理 ${file.name} 失败:`, error.message);
        }
    }
    
    return results;
}

/**
 * 示例7: 角色卡数据迁移（从V1升级到V2）
 */
function migrateCharacterCardToV2(oldCharacterData) {
    try {
        // 标准化数据
        const normalized = CharacterCardUtils.normalize(oldCharacterData);
        
        // 确保是V2格式
        if (!normalized.spec.includes('v2')) {
            normalized.spec = 'chara_card_v2';
            normalized.spec_version = '2.0';
            
            // 添加V2特有的字段
            if (!normalized.data.alternate_greetings) {
                normalized.data.alternate_greetings = [];
            }
            
            if (!normalized.data.character_book) {
                normalized.data.character_book = {
                    name: `${normalized.data.name}的世界书`,
                    description: '',
                    scan_depth: 5,
                    token_budget: 2048,
                    entries: []
                };
            }
        }
        
        console.log('迁移到V2格式成功');
        return normalized;
    } catch (error) {
        console.error('迁移失败:', error.message);
        return null;
    }
}

/**
 * 示例8: 提取角色卡中的世界书数据
 */
function extractWorldBookData(characterData) {
    const worldBooks = [];
    
    if (characterData.data?.character_book?.entries) {
        // V2格式世界书
        const worldBook = {
            name: characterData.data.character_book.name || '未命名世界书',
            description: characterData.data.character_book.description || '',
            entries: characterData.data.character_book.entries.map(entry => ({
                name: entry.comment || entry.name || '未命名条目',
                keywords: entry.keys || [],
                content: entry.content || '',
                enabled: entry.enabled !== false,
                priority: entry.insertion_order || 0,
                settings: entry.extensions || {}
            }))
        };
        worldBooks.push(worldBook);
    }
    
    if (Array.isArray(characterData.data?.lore)) {
        // V3格式世界书
        const worldBook = {
            name: '角色背景设定',
            description: 'V3格式的背景设定',
            entries: characterData.data.lore.map(entry => ({
                name: entry.comment || entry.name || '背景设定',
                keywords: entry.keys || [],
                content: entry.content || '',
                enabled: entry.enabled !== false,
                priority: entry.priority || 0,
                settings: entry.extensions || {}
            }))
        };
        worldBooks.push(worldBook);
    }
    
    return worldBooks;
}

/**
 * 示例9: 角色卡搜索和过滤
 */
function searchCharacters(characters, searchTerm) {
    const results = characters.filter(char => {
        const data = char.data || char;
        
        // 搜索角色名称
        if (data.name && data.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return true;
        }
        
        // 搜索描述
        if (data.description && data.description.toLowerCase().includes(searchTerm.toLowerCase())) {
            return true;
        }
        
        // 搜索世界书内容
        if (data.character_book?.entries) {
            const found = data.character_book.entries.some(entry => 
                entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.keys.some(key => key.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            if (found) return true;
        }
        
        return false;
    });
    
    return results;
}

/**
 * 示例10: 角色卡统计信息
 */
function getCharacterStatistics(characterData) {
    const data = characterData.data || characterData;
    
    const stats = {
        name: data.name || '未知',
        version: characterData.spec || '未知',
        fieldCounts: {
            description: data.description ? data.description.length : 0,
            personality: data.personality ? data.personality.length : 0,
            scenario: data.scenario ? data.scenario.length : 0,
            firstMessage: data.first_message ? data.first_message.length : 0,
            exampleMessages: data.message_example ? data.message_example.length : 0,
            alternateGreetings: data.alternate_greetings ? data.alternate_greetings.length : 0
        },
        worldBook: {
            hasWorldBook: !!(data.character_book?.entries?.length || data.lore?.length),
            entryCount: data.character_book?.entries?.length || data.lore?.length || 0,
            totalContent: 0
        }
    };
    
    // 计算世界书内容总长度
    if (data.character_book?.entries) {
        stats.worldBook.totalContent = data.character_book.entries.reduce(
            (total, entry) => total + (entry.content ? entry.content.length : 0), 0
        );
    } else if (data.lore) {
        stats.worldBook.totalContent = data.lore.reduce(
            (total, entry) => total + (entry.content ? entry.content.length : 0), 0
        );
    }
    
    return stats;
}

// ========== 使用示例（在HTML页面中） ==========

/**
 * 完整的HTML页面使用示例
 */
function setupCharacterCardInterface() {
    // 文件上传处理
    const fileInput = document.getElementById('character-file');
    fileInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                const result = await CharacterCardUtils.parseFile(file);
                displayCharacterInfo(result.data);
            } catch (error) {
                alert('解析失败: ' + error.message);
            }
        }
    });
    
    // 导出按钮处理
    const exportButton = document.getElementById('export-button');
    exportButton?.addEventListener('click', () => {
        const characterData = getCurrentCharacterData(); // 假设这个函数获取当前编辑的数据
        try {
            const pngData = CharacterCardUtils.exportToPNG(characterData);
            CharacterCardUtils.downloadPNG(pngData, `${characterData.data.name}.png`);
        } catch (error) {
            alert('导出失败: ' + error.message);
        }
    });
}

/**
 * 显示角色信息到页面
 */
function displayCharacterInfo(characterData) {
    const data = characterData.data || characterData;
    
    document.getElementById('char-name').textContent = data.name || '未知';
    document.getElementById('char-description').textContent = data.description || '无描述';
    document.getElementById('char-personality').textContent = data.personality || '无性格描述';
    
    // 显示世界书信息
    const worldBookDiv = document.getElementById('world-book-info');
    if (data.character_book?.entries?.length > 0) {
        worldBookDiv.innerHTML = `
            <h3>世界书: ${data.character_book.name}</h3>
            <p>条目数量: ${data.character_book.entries.length}</p>
            <ul>
                ${data.character_book.entries.map(entry => 
                    `<li><strong>${entry.comment || '未命名'}:</strong> ${entry.content.substring(0, 100)}...</li>`
                ).join('')}
            </ul>
        `;
    } else {
        worldBookDiv.innerHTML = '<p>无世界书数据</p>';
    }
}

// ========== 导出演示函数 ==========

// 如果在Node.js环境中运行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseCharacterCardFromFile,
        parseCharacterCardFromBase64,
        createNewCharacterCard,
        exportCharacterCard,
        validateCharacterCard,
        batchProcessCharacterCards,
        migrateCharacterCardToV2,
        extractWorldBookData,
        searchCharacters,
        getCharacterStatistics,
        setupCharacterCardInterface
    };
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
    window.CharacterCardExamples = {
        parseCharacterCardFromFile,
        parseCharacterCardFromBase64,
        createNewCharacterCard,
        exportCharacterCard,
        validateCharacterCard,
        batchProcessCharacterCards,
        migrateCharacterCardToV2,
        extractWorldBookData,
        searchCharacters,
        getCharacterStatistics,
        setupCharacterCardInterface
    };
}