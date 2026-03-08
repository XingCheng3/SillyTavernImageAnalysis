/**
 * SillyTavern Compatible Character Card Parser & Exporter
 * 基于SillyTavern源码的完整角色卡解析与导出封装模块
 * 
 * 特性:
 * - 支持V1、V2、V3格式的角色卡
 * - 完整的世界书(Lorebook)支持
 * - 浏览器环境兼容
 * - 即调即用的API
 * - 数据完整性保证
 * 
 * @author Based on SillyTavern project
 * @version 1.0.0
 */

// ==================== 常量定义 ====================

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

const SUPPORTED_SPECS = {
    V1: 'chara_card_v1',
    V2: 'chara_card_v2', 
    V3: 'chara_card_v3'
};

const DEFAULT_WORLD_INFO_ENTRY = {
    // 基本字段
    id: 0,
    keys: [],
    secondary_keys: [],
    comment: '',
    content: '',
    constant: false,
    selective: false,
    insertion_order: 0,
    enabled: true,
    position: 'after_char',
    
    // 扩展字段
    extensions: {
        position: 1, // 0=before, 1=after
        depth: 4,
        display_index: 0,
        probability: 100,
        useProbability: true,
        selectiveLogic: 0, // 0=AND_ANY
        group: '',
        group_override: false,
        group_weight: 100,
        scan_depth: null,
        case_sensitive: null,
        match_whole_words: null,
        use_group_scoring: null,
        exclude_recursion: false,
        prevent_recursion: false,
        delay_until_recursion: false,
        automation_id: '',
        role: 0, // 0=SYSTEM
        vectorized: false,
        sticky: null,
        cooldown: null,
        delay: null
    }
};

// ==================== 工具函数 ====================

/**
 * 检查是否为PNG文件
 * @param {Uint8Array} data - 文件数据
 * @returns {boolean} 是否为PNG文件
 */
function isPNG(data) {
    if (!data || data.length < 8) return false;
    
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (data[i] !== PNG_SIGNATURE[i]) {
            return false;
        }
    }
    return true;
}

/**
 * 计算CRC32校验值
 * @param {Uint8Array} data - 要计算的数据
 * @returns {number} CRC32值
 */
function calculateCRC32(data) {
    const makeCRCTable = () => {
        let c;
        const crcTable = [];
        
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        
        return crcTable;
    };

    let crc = 0xffffffff;
    const crcTable = makeCRCTable();
    
    for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    
    return crc ^ 0xffffffff;
}

/**
 * 创建PNG tEXt块
 * @param {string} keyword - 关键字
 * @param {string} text - 文本内容
 * @returns {Uint8Array} PNG tEXt块数据
 */
function createTextChunk(keyword, text) {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const length = keywordBytes.length + 1 + textBytes.length;
    
    const chunk = new Uint8Array(4 + 4 + length + 4);
    
    // 设置长度（大端序）
    chunk[0] = (length >> 24) & 0xff;
    chunk[1] = (length >> 16) & 0xff;
    chunk[2] = (length >> 8) & 0xff;
    chunk[3] = length & 0xff;
    
    // 设置类型（"tEXt"）
    chunk[4] = 116; // t
    chunk[5] = 69;  // E
    chunk[6] = 88;  // X
    chunk[7] = 116; // t
    
    // 设置数据
    let offset = 8;
    for (let i = 0; i < keywordBytes.length; i++) {
        chunk[offset++] = keywordBytes[i];
    }
    chunk[offset++] = 0; // 分隔符
    for (let i = 0; i < textBytes.length; i++) {
        chunk[offset++] = textBytes[i];
    }
    
    // 计算CRC
    const crc = calculateCRC32(chunk.slice(4, 8 + length));
    
    // 设置CRC（大端序）
    chunk[8 + length] = (crc >> 24) & 0xff;
    chunk[8 + length + 1] = (crc >> 16) & 0xff;
    chunk[8 + length + 2] = (crc >> 8) & 0xff;
    chunk[8 + length + 3] = crc & 0xff;
    
    return chunk;
}

/**
 * 安全的Base64编码，支持UTF-8字符
 * @param {string} text - 要编码的UTF-8字符串
 * @returns {string} Base64编码的字符串
 */
function safeBase64Encode(text) {
    try {
        // 使用TextEncoder确保正确的UTF-8编码
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        
        // 将字节数组转换为二进制字符串
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        
        return btoa(binaryString);
    } catch (error) {
        console.error('Base64编码失败:', error);
        // 回退到传统方法
        return btoa(unescape(encodeURIComponent(text)));
    }
}

/**
 * 安全的Base64解码，支持UTF-8字符
 * @param {string} base64String - Base64编码的字符串
 * @returns {string} 解码后的UTF-8字符串
 */
function safeBase64Decode(base64String) {
    try {
        // 使用TextDecoder确保正确的UTF-8解码
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
    } catch (error) {
        console.error('Base64解码失败:', error);
        // 回退到简单解码
        return atob(base64String);
    }
}

/**
 * 从PNG中提取数据 (基于SillyTavern的实现，修复编码问题)
 * @param {Uint8Array} data - PNG文件数据
 * @param {string} identifier - 要查找的标识符
 * @returns {Object|null} 提取的JSON数据
 */
function extractDataFromPNG(data, identifier = 'chara') {
    console.log('正在尝试PNG导入...');
    
    let uint8 = new Uint8Array(4);
    let uint32 = new Uint32Array(uint8.buffer);

    // 检查PNG头是否有效
    if (!isPNG(data)) {
        console.log('PNG头无效');
        return null;
    }

    let ended = false;
    let chunks = [];
    let idx = 8;

    while (idx < data.length) {
        // 读取当前块的长度
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        let length = uint32[0] + 4;
        let chunk = new Uint8Array(length);
        chunk[0] = data[idx++];
        chunk[1] = data[idx++];
        chunk[2] = data[idx++];
        chunk[3] = data[idx++];

        // 获取块名称
        let name = (
            String.fromCharCode(chunk[0]) +
            String.fromCharCode(chunk[1]) +
            String.fromCharCode(chunk[2]) +
            String.fromCharCode(chunk[3])
        );

        // IHDR必须是第一个块
        if (!chunks.length && name !== 'IHDR') {
            console.log('警告: IHDR头缺失');
        }

        // IEND标记文件结束
        if (name === 'IEND') {
            ended = true;
            chunks.push({
                name: name,
                data: new Uint8Array(0),
            });
            break;
        }

        // 读取块内容
        for (let i = 4; i < length; i++) {
            chunk[i] = data[idx++];
        }

        // 读取CRC值
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        let chunkData = new Uint8Array(chunk.buffer.slice(4));

        chunks.push({
            name: name,
            data: chunkData,
        });
    }

    if (!ended) {
        console.log('.png文件提前结束: 没有找到IEND头');
    }

    // 查找包含角色数据的块，支持ccv3和chara
    const identifiers = identifier === 'chara' ? ['ccv3', 'chara'] : [identifier];
    
    for (const id of identifiers) {
        let found = chunks.filter(x => (
            x.name === 'tEXt'
            && x.data.length > id.length
            && x.data.slice(0, id.length).every((v, i) => String.fromCharCode(v) === id[i])
        ));

        if (found.length > 0) {
            try {
                // 提取Base64数据部分
                let bytes = found[0].data;
                let b64buf = '';
                
                // 跳过标识符和空字节分隔符
                for (let i = id.length + 1; i < bytes.length; i++) {
                    b64buf += String.fromCharCode(bytes[i]);
                }
                
                console.log(`找到${id}数据，Base64长度:`, b64buf.length);
                
                // 使用安全的UTF-8解码
                const decodedText = safeBase64Decode(b64buf);
                console.log('解码后的文本长度:', decodedText.length);
                
                // 解析JSON
                const decoded = JSON.parse(decodedText);
                console.log('成功解析角色卡数据:', decoded);
                return decoded;
                
            } catch (e) {
                console.log(`解码${id}块时出错:`, e);
                console.log('尝试备用解码方法...');
                
                // 备用解码方法：直接使用atob
                try {
                    let bytes = found[0].data;
                    let b64buf = '';
                    for (let i = id.length + 1; i < bytes.length; i++) {
                        b64buf += String.fromCharCode(bytes[i]);
                    }
                    
                    const fallbackDecoded = JSON.parse(atob(b64buf));
                    console.log('备用方法解析成功');
                    return fallbackDecoded;
                } catch (fallbackError) {
                    console.log('备用解码方法也失败:', fallbackError);
                    continue;
                }
            }
        }
    }

    console.log('PNG图像不包含数据');
    return null;
}

/**
 * 提取PNG图像块用于重建
 * @param {Uint8Array} data - PNG数据
 * @returns {Object} 包含各种块的对象
 */
function extractPNGChunks(data) {
    const chunks = {
        ihdr: null,
        others: [],
        iend: null
    };
    
    let idx = 8; // 跳过PNG签名
    let uint8 = new Uint8Array(4);
    let uint32 = new Uint32Array(uint8.buffer);
    
    try {
        while (idx < data.length - 12) {
            // 读取长度
            uint8[3] = data[idx++];
            uint8[2] = data[idx++];
            uint8[1] = data[idx++];
            uint8[0] = data[idx++];
            
            const length = uint32[0];
            
            if (idx + 4 + length + 4 > data.length) {
                console.warn('块数据超出数组范围');
                break;
            }
            
            const chunkType = String.fromCharCode(
                data[idx], data[idx + 1], data[idx + 2], data[idx + 3]
            );
            
            const chunkStart = idx - 4;
            const chunkEnd = idx + 4 + length + 4;
            
            // 分类保存不同类型的块
            if (chunkType === 'IHDR') {
                chunks.ihdr = data.slice(chunkStart, chunkEnd);
            } else if (chunkType === 'IEND') {
                chunks.iend = data.slice(chunkStart, chunkEnd);
                break;
            } else {
                // 默认保留该块
                let keep = true;
                if (chunkType === 'tEXt' || chunkType === 'zTXt') {
                    // 解析关键字，若为 chara/ccv3 则跳过（不保留旧的角色卡数据）
                    try {
                        const dataStart = idx + 4; // 跳过chunk type
                        const dataEnd = dataStart + length;
                        const chunkData = data.slice(dataStart, dataEnd);
                        const nulIndex = chunkData.indexOf(0);
                        if (nulIndex > 0) {
                            const keyword = String.fromCharCode.apply(null, Array.from(chunkData.slice(0, nulIndex))).toLowerCase();
                            if (keyword === 'chara' || keyword === 'ccv3') {
                                keep = false;
                            }
                        }
                    } catch (e) {
                        // 解析失败时，保守地保留该块
                        keep = true;
                    }
                }
                if (keep) {
                    chunks.others.push(data.slice(chunkStart, chunkEnd));
                }
            }
            
            idx = chunkEnd;
        }
        
        console.log(`提取了: IHDR=${chunks.ihdr ? '是' : '否'}, 其他块=${chunks.others.length}, IEND=${chunks.iend ? '是' : '否'}`);
        return chunks;
    } catch (err) {
        console.error("提取PNG块时出错:", err);
        return chunks;
    }
}

/**
 * 创建最小PNG文件
 * @param {string} base64Data - Base64编码的角色卡数据
 * @param {string} keyword - 关键字（chara或ccv3）
 * @returns {Uint8Array} PNG文件数据
 */
function createMinimalPNG(base64Chara, base64V3) {
    const pngSignature = new Uint8Array(PNG_SIGNATURE);
    
    // IHDR块（1x1像素的透明PNG）
    const ihdrData = new Uint8Array([
        0, 0, 0, 1,    // 宽度
        0, 0, 0, 1,    // 高度
        8,             // 位深度
        6,             // 颜色类型（RGBA）
        0,             // 压缩方法
        0,             // 过滤方法
        0              // 隔行扫描方法
    ]);
    
    const ihdrChunk = new Uint8Array(4 + 4 + ihdrData.length + 4);
    // 长度
    ihdrChunk[3] = ihdrData.length;
    // 类型
    ihdrChunk[4] = 73; ihdrChunk[5] = 72; ihdrChunk[6] = 68; ihdrChunk[7] = 82; // IHDR
    // 数据
    ihdrChunk.set(ihdrData, 8);
    // CRC
    const ihdrCrc = calculateCRC32(ihdrChunk.slice(4, 8 + ihdrData.length));
    ihdrChunk[8 + ihdrData.length] = (ihdrCrc >> 24) & 0xff;
    ihdrChunk[8 + ihdrData.length + 1] = (ihdrCrc >> 16) & 0xff;
    ihdrChunk[8 + ihdrData.length + 2] = (ihdrCrc >> 8) & 0xff;
    ihdrChunk[8 + ihdrData.length + 3] = ihdrCrc & 0xff;
    
    // IDAT块（透明像素）
    const idatData = new Uint8Array([120, 156, 99, 96, 0, 0, 0, 2, 0, 1]);
    const idatChunk = new Uint8Array(4 + 4 + idatData.length + 4);
    idatChunk[3] = idatData.length;
    idatChunk[4] = 73; idatChunk[5] = 68; idatChunk[6] = 65; idatChunk[7] = 84; // IDAT
    idatChunk.set(idatData, 8);
    const idatCrc = calculateCRC32(idatChunk.slice(4, 8 + idatData.length));
    idatChunk[8 + idatData.length] = (idatCrc >> 24) & 0xff;
    idatChunk[8 + idatData.length + 1] = (idatCrc >> 16) & 0xff;
    idatChunk[8 + idatData.length + 2] = (idatCrc >> 8) & 0xff;
    idatChunk[8 + idatData.length + 3] = idatCrc & 0xff;
    
    // 角色卡数据块：同时写入 chara 与 ccv3
    const textChunkChara = createTextChunk('chara', base64Chara);
    const textChunkV3 = createTextChunk('ccv3', base64V3);
    
    // IEND块
    const iendChunk = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    
    // 组装PNG
    const totalLength = pngSignature.length + ihdrChunk.length + idatChunk.length + textChunkChara.length + textChunkV3.length + iendChunk.length;
    const pngData = new Uint8Array(totalLength);
    
    let pos = 0;
    pngData.set(pngSignature, pos); pos += pngSignature.length;
    pngData.set(ihdrChunk, pos); pos += ihdrChunk.length;
    pngData.set(idatChunk, pos); pos += idatChunk.length;
    pngData.set(textChunkChara, pos); pos += textChunkChara.length;
    pngData.set(textChunkV3, pos); pos += textChunkV3.length;
    pngData.set(iendChunk, pos);
    
    return pngData;
}

// ==================== 数据验证与标准化 ====================

/**
 * 验证是否为有效的角色卡数据
 * @param {Object} data - 要验证的数据
 * @returns {boolean} 是否为有效角色卡
 */
function isValidCharacterData(data) {
    if (!data || typeof data !== 'object') return false;
    
    // 检查是否有必要的角色信息
    const hasCharacterInfo = data.name || data.data?.name;
    
    // V3格式检查
    if (data.spec && data.spec.includes('v3')) {
        return hasCharacterInfo && (data.data || data.lore !== undefined);
    }
    
    // V2格式检查
    if (data.spec && data.spec.includes('v2')) {
        return hasCharacterInfo && data.data;
    }
    
    // V1格式或直接格式检查
    return hasCharacterInfo;
}

/**
 * 标准化角色卡数据
 * @param {Object} rawData - 原始数据
 * @returns {Object} 标准化后的数据
 */
function normalizeCharacterData(rawData) {
    if (!isValidCharacterData(rawData)) {
        throw new Error('无效的角色卡数据');
    }
    
    // 深拷贝避免修改原始数据
    const data = JSON.parse(JSON.stringify(rawData));
    
    // 确定规格版本
    let spec = data.spec || '';
    if (!spec) {
        if (data.extensions || Array.isArray(data.lore) || Array.isArray(data.greetings)) {
            spec = SUPPORTED_SPECS.V3;
        } else if (data.character_book || data.alternate_greetings) {
            spec = SUPPORTED_SPECS.V2;
        } else {
            spec = SUPPORTED_SPECS.V1;
        }
        data.spec = spec;
    }
    
    // 如果数据直接在根级，包装到data字段中
    if (!data.data && data.name) {
        const characterData = { ...data };
        delete characterData.spec;
        delete characterData.spec_version;
        data.data = characterData;
    }
    
    // 标准化字段名称
    const charData = data.data || data;
    const isV3 = spec && spec.includes('v3');
    
    // 处理问候语 - 根据版本采用不同策略
    if (isV3) {
        // V3格式：优先使用greetings数组，同时保持first_mes兼容性
        if (Array.isArray(charData.greetings) && charData.greetings.length > 0) {
            // 如果有greetings数组，使用它作为主要数据源
            if (!charData.first_mes) {
                charData.first_mes = charData.greetings[0];
            }
            if (!charData.first_message) {
                charData.first_message = charData.greetings[0];
            }
            // 处理备选问候语
            if (charData.greetings.length > 1) {
                charData.alternate_greetings = charData.greetings.slice(1);
            }
        } else if (charData.first_mes || charData.first_message) {
            // 如果没有greetings但有first_mes/first_message，创建greetings数组
            const firstMessage = charData.first_mes || charData.first_message;
            charData.greetings = [firstMessage];
            charData.first_mes = firstMessage;
            charData.first_message = firstMessage;
            
            // 处理备选问候语
            if (charData.alternate_greetings && charData.alternate_greetings.length > 0) {
                charData.greetings = charData.greetings.concat(charData.alternate_greetings);
            }
        }
    } else {
        // V1/V2格式：使用传统的first_mes和alternate_greetings
        if (charData.first_mes && !charData.first_message) {
            charData.first_message = charData.first_mes;
        }
        if (charData.first_message && !charData.first_mes) {
            charData.first_mes = charData.first_message;
        }
        
        // 处理greetings数组（如果存在）
        if (Array.isArray(charData.greetings) && charData.greetings.length > 0) {
            charData.first_mes = charData.greetings[0];
            charData.first_message = charData.greetings[0];
            if (charData.greetings.length > 1) {
                charData.alternate_greetings = charData.greetings.slice(1);
            }
        }
    }
    
    // 处理示例对话 - 根据版本采用不同策略
    if (isV3) {
        // V3格式：优先使用mes_example，同时保持message_example兼容性
        if (charData.mes_example && !charData.message_example) {
            charData.message_example = charData.mes_example;
        }
        if (charData.message_example && !charData.mes_example) {
            charData.mes_example = charData.message_example;
        }
        if (charData.dialogue && !charData.mes_example && !charData.message_example) {
            charData.mes_example = charData.dialogue;
            charData.message_example = charData.dialogue;
        }
    } else {
        // V1/V2格式：使用传统的mes_example
        if (charData.mes_example && !charData.message_example) {
            charData.message_example = charData.mes_example;
        }
        if (charData.message_example && !charData.mes_example) {
            charData.mes_example = charData.message_example;
        }
        if (charData.dialogue && !charData.mes_example && !charData.message_example) {
            charData.mes_example = charData.dialogue;
            charData.message_example = charData.dialogue;
        }
    }
    
    return data;
}

/**
 * 转换世界书条目（基于SillyTavern的convertCharacterBook）
 * @param {Object} characterBook - 角色书数据
 * @returns {Object} 转换后的世界书数据
 */
function convertCharacterBook(characterBook) {
    if (!characterBook || !characterBook.entries) {
        return { entries: {}, originalData: characterBook };
    }
    
    const result = { entries: {}, originalData: characterBook };

    characterBook.entries.forEach((entry, index) => {
        // 确保entry有id
        if (entry.id === undefined) {
            entry.id = index;
        }

        result.entries[entry.id] = {
            ...DEFAULT_WORLD_INFO_ENTRY,
            uid: entry.id,
            key: entry.keys || [],
            keysecondary: entry.secondary_keys || [],
            comment: entry.comment || entry.name || '',
            content: entry.content || '',
            constant: entry.constant || false,
            selective: entry.selective || false,
            order: entry.insertion_order || entry.priority || 0,
            position: entry.extensions?.position ?? (entry.position === 'before_char' ? 0 : 1),
            excludeRecursion: entry.extensions?.exclude_recursion ?? false,
            preventRecursion: entry.extensions?.prevent_recursion ?? false,
            delayUntilRecursion: entry.extensions?.delay_until_recursion ?? false,
            disable: !entry.enabled,
            addMemo: !!entry.comment,
            displayIndex: entry.extensions?.display_index ?? index,
            probability: entry.extensions?.probability ?? 100,
            useProbability: entry.extensions?.useProbability ?? true,
            depth: entry.extensions?.depth ?? 4,
            selectiveLogic: entry.extensions?.selectiveLogic ?? 0,
            group: entry.extensions?.group ?? '',
            groupOverride: entry.extensions?.group_override ?? false,
            groupWeight: entry.extensions?.group_weight ?? 100,
            scanDepth: entry.extensions?.scan_depth ?? null,
            caseSensitive: entry.extensions?.case_sensitive ?? null,
            matchWholeWords: entry.extensions?.match_whole_words ?? null,
            useGroupScoring: entry.extensions?.use_group_scoring ?? null,
            automationId: entry.extensions?.automation_id ?? '',
            role: entry.extensions?.role ?? 0,
            vectorized: entry.extensions?.vectorized ?? false,
            sticky: entry.extensions?.sticky ?? null,
            cooldown: entry.extensions?.cooldown ?? null,
            delay: entry.extensions?.delay ?? null,
            extensions: entry.extensions || {},
        };
    });

    return result;
}

// ==================== 主要API ====================

/**
 * 角色卡解析器类
 */
class CharacterCardParser {
    
    /**
     * 从文件解析角色卡
     * @param {File} file - PNG文件
     * @returns {Promise<Object>} 解析后的角色卡数据
     */
    static async parseFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('没有提供文件'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const arrayBuffer = event.target.result;
                    const data = await this.parseFromBuffer(arrayBuffer);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * 从ArrayBuffer解析角色卡
     * @param {ArrayBuffer} buffer - 文件缓冲区
     * @returns {Promise<Object>} 解析后的角色卡数据
     */
    static async parseFromBuffer(buffer) {
        const bytes = new Uint8Array(buffer);
        
        if (!isPNG(bytes)) {
            throw new Error('不是有效的PNG文件');
        }
        
        // 尝试提取角色卡数据
        const rawData = extractDataFromPNG(bytes, 'chara');
        
        if (!rawData) {
            throw new Error('PNG文件中未找到角色卡数据');
        }
        
        // 标准化数据
        const normalizedData = normalizeCharacterData(rawData);
        
        // 处理世界书数据
        if (normalizedData.data?.character_book) {
            normalizedData.worldInfo = convertCharacterBook(normalizedData.data.character_book);
        }
        
        return {
            success: true,
            data: normalizedData,
            metadata: {
                spec: normalizedData.spec,
                hasWorldBook: !!(normalizedData.data?.character_book?.entries?.length || normalizedData.data?.lore?.length),
                version: this.getVersionFromSpec(normalizedData.spec)
            }
        };
    }
    
    /**
     * 从Base64字符串解析角色卡
     * @param {string} base64String - Base64编码的PNG数据
     * @returns {Promise<Object>} 解析后的角色卡数据
     */
    static async parseFromBase64(base64String) {
        try {
            // 移除data URL前缀（如果存在）
            const base64Data = base64String.replace(/^data:image\/png;base64,/, '');
            
            // 解码为二进制数据
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            return await this.parseFromBuffer(bytes.buffer);
        } catch (error) {
            throw new Error(`Base64解析失败: ${error.message}`);
        }
    }
    
    /**
     * 导出角色卡到PNG
     * @param {Object} characterData - 角色卡数据
     * @param {Uint8Array} [originalPngData] - 原始PNG数据（可选）
     * @returns {Uint8Array} PNG文件数据
     */
    static exportToPNG(characterData, originalPngData = null) {
        try {
            // 验证数据
            if (!isValidCharacterData(characterData)) {
                throw new Error('无效的角色卡数据');
            }
            
            // 深拷贝并标准化数据
            const exportData = this.prepareExportData(characterData);
            
            // 序列化为JSON
            const jsonString = JSON.stringify(exportData);
            console.log('导出JSON长度:', jsonString.length);
            
            // 使用安全的UTF-8编码方式
            const base64Chara = safeBase64Encode(jsonString);

            // 构建 v3 版本数据（用于 ccv3 块），确保规范与版本
            const v3Obj = JSON.parse(jsonString);
            v3Obj.spec = 'chara_card_v3';
            v3Obj.spec_version = '3.0';
            const base64V3 = safeBase64Encode(JSON.stringify(v3Obj));
            
            if (originalPngData && originalPngData.length > 0) {
                // 基于原始PNG重建（保留非 chara/ccv3 文本块）
                return this.rebuildPNGWithData(originalPngData, base64Chara, base64V3);
            } else {
                // 创建最小PNG（同时写入 chara 与 ccv3）
                return createMinimalPNG(base64Chara, base64V3);
            }
            
        } catch (error) {
            console.error('导出失败:', error);
            throw new Error(`导出角色卡失败: ${error.message}`);
        }
    }
    
    /**
     * 重建PNG文件（基于原始PNG添加新数据）
     * @param {Uint8Array} originalData - 原始PNG数据
     * @param {string} base64Data - Base64编码的角色卡数据
     * @param {string} keyword - 关键字
     * @returns {Uint8Array} 新的PNG数据
     */
    static rebuildPNGWithData(originalData, base64Chara, base64V3) {
        try {
            const chunks = extractPNGChunks(originalData);
            
            if (!chunks.ihdr) {
                throw new Error('未找到IHDR块，无法重建PNG');
            }
            
            // 创建新的tEXt块（chara 与 ccv3）
            const textChunkChara = createTextChunk('chara', base64Chara);
            const textChunkV3 = createTextChunk('ccv3', base64V3);
            
            // 计算总长度
            let totalLength = PNG_SIGNATURE.length + chunks.ihdr.length;
            chunks.others.forEach(chunk => totalLength += chunk.length);
            totalLength += textChunkChara.length;
            totalLength += textChunkV3.length;
            totalLength += chunks.iend ? chunks.iend.length : 12;
            
            // 构建新PNG
            const newPngData = new Uint8Array(totalLength);
            let pos = 0;
            
            // PNG签名
            newPngData.set(PNG_SIGNATURE, pos);
            pos += PNG_SIGNATURE.length;
            
            // IHDR块
            newPngData.set(chunks.ihdr, pos);
            pos += chunks.ihdr.length;
            
            // 其他图像块
            chunks.others.forEach(chunk => {
                newPngData.set(chunk, pos);
                pos += chunk.length;
            });
            
            // 角色卡数据块（chara 与 ccv3）
            newPngData.set(textChunkChara, pos);
            pos += textChunkChara.length;
            newPngData.set(textChunkV3, pos);
            pos += textChunkV3.length;
            
            // IEND块
            if (chunks.iend) {
                newPngData.set(chunks.iend, pos);
            } else {
                const iendChunk = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
                newPngData.set(iendChunk, pos);
            }
            
            return newPngData;
            
        } catch (error) {
            console.error('重建PNG失败，使用最小PNG:', error);
            return createMinimalPNG(base64Chara, base64V3);
        }
    }
    
    /**
     * 准备导出数据（包含完整的世界书转换和字段映射）
     * @param {Object} characterData - 角色卡数据
     * @returns {Object} 准备好的导出数据
     */
    static prepareExportData(characterData) {
        const exportData = JSON.parse(JSON.stringify(characterData));
        
        console.log('=== 导出数据准备开始 ===');
        console.log('原始数据 spec:', exportData.spec);
        console.log('原始 first_message:', exportData.data?.first_message);
        console.log('原始 first_mes:', exportData.data?.first_mes);
        console.log('原始 greetings:', exportData.data?.greetings);
        console.log('原始 message_example:', exportData.data?.message_example);
        console.log('原始 mes_example:', exportData.data?.mes_example);
        
        // 规范与版本补齐
        if (exportData.spec && exportData.spec.includes('v3')) {
            exportData.spec_version = exportData.spec_version || '3.0';
        } else if (exportData.spec && exportData.spec.includes('v2')) {
            exportData.spec_version = exportData.spec_version || '2.0';
        }

        const isV3 = exportData.spec && exportData.spec.includes('v3');
        
        // 处理首次问候语的版本兼容性映射
        if (exportData.data?.first_message || exportData.data?.first_mes) {
            if (isV3) {
                // V3格式：保持greetings数组作为主要格式，同时保留first_mes兼容性
                console.log('检测到V3格式，处理greetings数组和first_mes字段');
                
                if (!Array.isArray(exportData.data.greetings)) {
                    exportData.data.greetings = [];
                }
                
                // 确定主要问候语
                const primaryGreeting = exportData.data.first_message || exportData.data.first_mes;
                exportData.data.greetings[0] = primaryGreeting;
                
                // 保留first_mes字段（V3格式的兼容性要求）
                exportData.data.first_mes = primaryGreeting;
                
                // 处理备选问候语
                if (exportData.data.alternate_greetings && exportData.data.alternate_greetings.length > 0) {
                    exportData.data.alternate_greetings.forEach((greeting, index) => {
                        if (greeting && greeting.trim()) {
                            exportData.data.greetings[index + 1] = greeting.trim();
                        }
                    });
                }
                
                // 清理内部使用的字段
                delete exportData.data.first_message;
                delete exportData.data.alternate_greetings;
                
                console.log('V3导出 greetings:', exportData.data.greetings);
                console.log('V3导出 first_mes:', exportData.data.first_mes);
                
            } else {
                // V1/V2格式：使用传统的first_mes字段
                console.log('检测到V1/V2格式，使用first_mes字段');
                
                const primaryGreeting = exportData.data.first_message || exportData.data.first_mes;
                exportData.data.first_mes = primaryGreeting;
                
                // 处理备选问候语（保持原有格式）
                if (exportData.data.alternate_greetings && exportData.data.alternate_greetings.length > 0) {
                    exportData.data.alternate_greetings = exportData.data.alternate_greetings.filter(greeting => greeting && greeting.trim());
                }
                
                // 清理不需要的字段
                delete exportData.data.first_message;
                delete exportData.data.greetings; // 确保删除V3字段
                
                console.log('V1/V2导出 first_mes:', exportData.data.first_mes);
                console.log('V1/V2导出 alternate_greetings:', exportData.data.alternate_greetings);
            }
        }
        
        // 处理示例对话的版本兼容性映射
        if (exportData.data?.message_example || exportData.data?.mes_example) {
            if (isV3) {
                // V3格式：保留mes_example字段，同时保持message_example兼容性
                console.log('V3格式：处理示例对话字段');
                
                const exampleDialog = exportData.data.message_example || exportData.data.mes_example;
                exportData.data.mes_example = exampleDialog;
                exportData.data.message_example = exampleDialog;
                
                // 清理旧字段
                delete exportData.data.dialogue;
                
                console.log('V3导出 mes_example:', exportData.data.mes_example);
                console.log('V3导出 message_example:', exportData.data.message_example);
            } else {
                // V1/V2格式：使用传统的mes_example字段
                console.log('V1/V2格式：使用mes_example字段');
                
                const exampleDialog = exportData.data.message_example || exportData.data.mes_example;
                exportData.data.mes_example = exampleDialog;
                
                // 清理不需要的字段
                delete exportData.data.message_example;
                delete exportData.data.dialogue;
                
                console.log('V1/V2导出 mes_example:', exportData.data.mes_example);
            }
        }
        
        // 处理世界书数据
        if (exportData.data?.book_entries && exportData.data.book_entries.length > 0) {
            // 确保character_book对象存在
            if (!exportData.data.character_book) {
                exportData.data.character_book = {
                    name: '世界书',
                    description: '',
                    scan_depth: 5,
                    token_budget: 2048,
                    entries: [],
                    extensions: {}
                };
            }
            
            // 转换世界书条目格式
            exportData.data.character_book.entries = exportData.data.book_entries.map((entry, index) => {
                return {
                    // 基本字段
                    id: entry.id !== undefined ? entry.id : index,
                    keys: entry.keys || [],
                    secondary_keys: entry.secondary_keys || [],
                    comment: entry.name || `条目 ${index + 1}`,
                    content: entry.content || '',
                    constant: entry.constant || false,
                    selective: entry.selective || false,
                    insertion_order: entry.priority || 0,
                    enabled: entry.enabled !== false,
                    position: entry.position === 'before_char' ? 'before_char' : 'after_char',
                    
                    // 扩展字段
                    extensions: {
                        position: entry.position === 'before_char' ? 0 : 1,
                        depth: entry.depth || 4,
                        display_index: entry.displayIndex !== undefined ? entry.displayIndex : index,
                        probability: entry.probability || 100,
                        useProbability: entry.useProbability !== false,
                        selectiveLogic: entry.selectiveLogic || 0,
                        group: entry.group || '',
                        group_override: entry.groupOverride || false,
                        group_weight: entry.groupWeight || 100,
                        scan_depth: entry.scanDepth || null,
                        case_sensitive: entry.caseSensitive || null,
                        match_whole_words: entry.matchWholeWords || null,
                        use_group_scoring: entry.useGroupScoring || null,
                        exclude_recursion: entry.excludeRecursion || false,
                        prevent_recursion: entry.preventRecursion || false,
                        delay_until_recursion: entry.delayUntilRecursion || false,
                        automation_id: entry.automationId || '',
                        role: entry.role || 0,
                        vectorized: entry.vectorized || false,
                        sticky: entry.sticky || null,
                        cooldown: entry.cooldown || null,
                        delay: entry.delay || null,
                        ...entry.extensions || {}
                    }
                };
            });
            
            // 删除临时字段
            delete exportData.data.book_entries;
        }

        // 若已存在character_book但缺少extensions，补齐
        if (exportData.data?.character_book && exportData.data.character_book.extensions === undefined) {
            exportData.data.character_book.extensions = {};
        }
        
        console.log('=== 导出数据准备完成 ===');
        console.log('最终导出数据:', exportData.data);
        
        return exportData;
    }
    
    /**
     * 获取规格版本号
     * @param {string} spec - 规格字符串
     * @returns {string} 版本号
     */
    static getVersionFromSpec(spec) {
        if (!spec) return 'unknown';
        if (spec.includes('v3')) return 'v3';
        if (spec.includes('v2')) return 'v2';
        if (spec.includes('v1')) return 'v1';
        return 'unknown';
    }
    
    /**
     * 验证角色卡数据
     * @param {Object} data - 角色卡数据
     * @returns {Object} 验证结果
     */
    static validateCharacterCard(data) {
        const errors = [];
        const warnings = [];
        
        if (!data) {
            errors.push('数据为空');
            return { valid: false, errors, warnings };
        }
        
        const charData = data.data || data;
        
        // 检查必要字段
        if (!charData.name) {
            errors.push('缺少角色名称');
        }
        
        if (!charData.description && !charData.personality) {
            warnings.push('没有角色描述或性格设定');
        }
        
        // 检查世界书
        if (charData.character_book && charData.character_book.entries) {
            charData.character_book.entries.forEach((entry, index) => {
                if (!entry.content) {
                    warnings.push(`世界书条目 ${index + 1} 内容为空`);
                }
                if (!entry.keys || entry.keys.length === 0) {
                    warnings.push(`世界书条目 ${index + 1} 没有关键字`);
                }
            });
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

// ==================== 工具函数导出 ====================

/**
 * 简化的API函数
 */
const CharacterCardUtils = {
    
    /**
     * 解析角色卡文件
     * @param {File} file - PNG文件
     * @returns {Promise<Object>} 角色卡数据
     */
    async parseFile(file) {
        return await CharacterCardParser.parseFromFile(file);
    },
    
    /**
     * 解析Base64角色卡
     * @param {string} base64 - Base64编码的PNG
     * @returns {Promise<Object>} 角色卡数据
     */
    async parseBase64(base64) {
        return await CharacterCardParser.parseFromBase64(base64);
    },
    
    /**
     * 导出角色卡
     * @param {Object} characterData - 角色卡数据
     * @param {Uint8Array} originalPng - 原始PNG数据（可选）
     * @returns {Uint8Array} PNG文件数据
     */
    exportToPNG(characterData, originalPng = null) {
        return CharacterCardParser.exportToPNG(characterData, originalPng);
    },
    
    /**
     * 验证角色卡
     * @param {Object} data - 角色卡数据
     * @returns {Object} 验证结果
     */
    validate(data) {
        return CharacterCardParser.validateCharacterCard(data);
    },
    
    /**
     * 标准化角色卡数据
     * @param {Object} rawData - 原始数据
     * @returns {Object} 标准化数据
     */
    normalize(rawData) {
        return normalizeCharacterData(rawData);
    },
    
    /**
     * 创建空的角色卡模板
     * @param {string} name - 角色名称
     * @returns {Object} 角色卡模板
     */
    createTemplate(name = '新角色') {
        return {
            spec: SUPPORTED_SPECS.V2,
            spec_version: '2.0',
            data: {
                name: name,
                description: '',
                personality: '',
                scenario: '',
                first_mes: `你好，我是${name}。`,
                mes_example: '',
                creator_notes: '',
                system_prompt: '',
                post_history_instructions: '',
                alternate_greetings: [],
                character_book: {
                    name: `${name}的世界书`,
                    description: '',
                    scan_depth: 5,
                    token_budget: 2048,
                    entries: []
                }
            }
        };
    },
    
    /**
     * 下载PNG文件
     * @param {Uint8Array} pngData - PNG数据
     * @param {string} filename - 文件名
     */
    downloadPNG(pngData, filename = 'character.png') {
        const blob = new Blob([pngData], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// ==================== 导出 ====================

// 默认导出主类
export default CharacterCardParser;

// 命名导出工具类和常量
export { 
    CharacterCardUtils,
    SUPPORTED_SPECS,
    DEFAULT_WORLD_INFO_ENTRY,
    isValidCharacterData,
    normalizeCharacterData,
    convertCharacterBook
};