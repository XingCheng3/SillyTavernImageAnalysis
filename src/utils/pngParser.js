import pako from 'pako';

/**
 * PNG解析器工具模块
 * 包含所有PNG格式角色卡的解析和处理功能
 */

// 检查是否为PNG文件
export const isPng = (bytes) => {
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < pngSignature.length; i++) {
        if (bytes[i] !== pngSignature[i]) {
            return false;
        }
    }
    return true;
};

// 查找null终止符
export const findNullTerminator = (data) => {
    let pos = 0;
    while (pos < data.length && data[pos] !== 0) {
        pos++;
    }
    return pos;
};

// 修复字符编码问题
export const fixCharacterEncoding = (data) => {
    // 创建一个深拷贝，避免修改原对象
    const fixedData = JSON.parse(JSON.stringify(data));
    
    // 递归处理对象中的所有字符串
    const fixEncoding = (obj) => {
        if (!obj) return obj;
        
        if (typeof obj === 'string') {
            // 尝试修复乱码
            try {
                // 检测是否为乱码的中文
                if (/[\u00a0-\uffff]/.test(obj) && /å|é|è|ä|ö|ü|ç|æ|ø|å/.test(obj)) {
                    // 尝试ISO-8859-1 -> UTF-8转换
                    const bytes = new Uint8Array(obj.length);
                    for (let i = 0; i < obj.length; i++) {
                        bytes[i] = obj.charCodeAt(i);
                    }
                    return new TextDecoder('utf-8').decode(bytes);
                }
            } catch (e) {
                console.error("修复编码失败:", e);
            }
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => fixEncoding(item));
        }
        
        if (typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                result[key] = fixEncoding(obj[key]);
            }
            return result;
        }
        
        return obj;
    };
    
    return fixEncoding(fixedData);
};

// 检查对象是否为角色卡数据
export const isCharacterData = (data) => {
    if (!data) return false;

    // V3 格式
    if (data.spec === 'character-card-spec-v3' && data.data) {
        return true;
    }

    // V2格式
    if (data.spec === 'chara_card_v2' && data.data) {
        return true;
    }

    // V1格式 (heuristic) - 更宽松的检查
    if (data.name &&
        (data.description !== undefined ||
            data.personality !== undefined ||
            data.scenario !== undefined ||
            data.first_mes !== undefined ||
            data.first_message !== undefined)) {
        return true;
    }

    // SillyTavern特有格式
    if (data.avatar && data.chat && data.name) {
        return true;
    }

    return false;
};

// 安全的Base64编码，支持UTF-8字符
const safeBase64EncodeInPngParser = (text) => {
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
};

// 安全的Base64解码，支持UTF-8字符
const safeBase64DecodeInPngParser = (base64String) => {
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
        // 回退到传统方法
        try {
            return decodeURIComponent(atob(base64String).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch (e) {
            // 最后的回退
            return atob(base64String);
        }
    }
};

// 尝试解码内容
export const tryDecodeContent = (keyword, contentBytes) => {
    if (keyword === 'chara' || keyword.startsWith('ccv')) {
        // 尝试方法1: 改进的Base64解码
        try {
            const content = new TextDecoder('utf-8').decode(contentBytes);
            const jsonString = safeBase64DecodeInPngParser(content);
            const data = JSON.parse(jsonString);

            if (isCharacterData(data)) {
                console.log("方法1成功: 改进的Base64解码");
                return fixCharacterEncoding(data);
            }
        } catch (e) {
            console.log("方法1失败: 改进的Base64解码", e);
        }
        
        // 尝试方法2: 直接JSON解析
        try {
            const content = new TextDecoder('utf-8').decode(contentBytes);
            const data = JSON.parse(content);
            if (isCharacterData(data)) {
                console.log("方法2成功: 直接JSON解析");
                return fixCharacterEncoding(data);
            }
        } catch (e) {
            console.log("方法2失败: 直接JSON解析", e);
        }
        
        // 尝试方法3: 传统Base64解码（备用）
        try {
            const content = new TextDecoder('utf-8').decode(contentBytes);
            const jsonString = atob(content);
            const data = JSON.parse(jsonString);

            if (isCharacterData(data)) {
                console.log("方法3成功: 传统Base64解码");
                return fixCharacterEncoding(data);
            }
        } catch (e) {
            console.log("方法3失败: 传统Base64解码", e);
        }
        
        // 尝试方法4: 使用不同的编码解码
        const encodings = ['iso-8859-1', 'windows-1252'];
        for (const encoding of encodings) {
            try {
                const decoder = new TextDecoder(encoding);
                const content = decoder.decode(contentBytes);
                
                // 尝试改进的Base64解码
                try {
                    const jsonString = safeBase64DecodeInPngParser(content);
                    const data = JSON.parse(jsonString);

                    if (isCharacterData(data)) {
                        console.log(`方法4成功: ${encoding} + 改进Base64解码`);
                        return fixCharacterEncoding(data);
                    }
                } catch (e) {
                    // Base64解码失败，尝试直接解析
                    try {
                        const data = JSON.parse(content);
                        if (isCharacterData(data)) {
                            console.log(`方法4成功: ${encoding} 直接解析`);
                            return fixCharacterEncoding(data);
                        }
                    } catch (e2) {
                        // 继续尝试下一种编码
                    }
                }
            } catch (e) {
                console.log(`方法4失败: ${encoding} 编码`, e);
            }
        }
    }
    
    return null;
};

// 解析文本块 (tEXt)
export const parseTextChunk = (textData) => {
    let keywordEnd = 0;
    while (keywordEnd < textData.length && textData[keywordEnd] !== 0) {
        keywordEnd++;
    }
    
    const keyword = new TextDecoder().decode(textData.slice(0, keywordEnd));
    const contentBytes = textData.slice(keywordEnd + 1);
    
    console.log(`tEXt 关键字: ${keyword}, 内容长度: ${contentBytes.length}`);
    
    // 尝试多种编码方式
    return tryDecodeContent(keyword, contentBytes);
};

// 解析压缩文本块 (zTXt)
export const parseCompressedTextChunk = (compressedData) => {
    let keywordEnd = 0;
    while (keywordEnd < compressedData.length && compressedData[keywordEnd] !== 0) {
        keywordEnd++;
    }
    
    const keyword = new TextDecoder().decode(compressedData.slice(0, keywordEnd));
    const compressionMethod = compressedData[keywordEnd + 1];
    
    console.log(`zTXt 关键字: ${keyword}, 压缩方法: ${compressionMethod}`);

    if ((keyword === 'chara' || keyword.startsWith('ccv')) && compressionMethod === 0) { // zlib压缩
        try {
            const compressedBytes = compressedData.slice(keywordEnd + 2);
            const decompressedBytes = pako.inflate(compressedBytes);
            
            // 使用相同的解码方法
            return tryDecodeContent(keyword, decompressedBytes);
        } catch (e) {
            console.error("zlib解压缩失败:", e);
            throw new Error("无法解压zTXt块");
        }
    }
    
    return null;
};

// 尝试多种解码方法
export const tryMultipleDecodingMethods = async (textData) => {
    const keywordEnd = findNullTerminator(textData);
    const keyword = new TextDecoder().decode(textData.slice(0, keywordEnd));
    const content = new TextDecoder().decode(textData.slice(keywordEnd + 1));

    console.log(`尝试解码: ${keyword}, 内容长度: ${content.length}`);

    // 方法1: 直接JSON解析
    try {
        const data = JSON.parse(content);
        if (isCharacterData(data)) {
            console.log("方法1成功: 直接JSON解析");
            return data;
        }
    } catch (e) {
        console.log("方法1失败: 直接JSON解析");
    }

    // 方法2: Base64解码后JSON解析
    try {
        const decodedContent = atob(content);
        const data = JSON.parse(decodedContent);
        if (isCharacterData(data)) {
            console.log("方法2成功: Base64解码后JSON解析");
            return data;
        }
    } catch (e) {
        console.log("方法2失败: Base64解码后JSON解析");
    }

    // 方法3: UTF-8解码后JSON解析
    try {
        const decoder = new TextDecoder('utf-8');
        const contentBytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) {
            contentBytes[i] = content.charCodeAt(i);
        }
        const decodedContent = decoder.decode(contentBytes);
        const data = JSON.parse(decodedContent);
        if (isCharacterData(data)) {
            console.log("方法3成功: UTF-8解码后JSON解析");
            return data;
        }
    } catch (e) {
        console.log("方法3失败: UTF-8解码后JSON解析");
    }

    // 方法4: 处理可能的特殊编码
    if (content.startsWith('eyJ')) {
        try {
            // 可能是Base64编码的JSON
            const decodedContent = atob(content);
            const data = JSON.parse(decodedContent);
            if (isCharacterData(data)) {
                console.log("方法4成功: 特殊Base64编码处理");
                return data;
            }
        } catch (e) {
            console.log("方法4失败: 特殊Base64编码处理");
        }
    }

    return null;
};

// 在块中查找角色卡数据
export const findCharacterDataInChunks = async (bytes) => {
    let offset = 8; // 跳过PNG签名
    let allTextChunks = []; // 保存所有tEXt块

    while (offset < bytes.length - 12) {
        const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 4;

        const chunkType = String.fromCharCode(
            bytes[offset], bytes[offset + 1],
            bytes[offset + 2], bytes[offset + 3]
        );
        offset += 4;

        console.log(`找到块: ${chunkType}, 长度: ${length}`);

        try {
            let data;
            if (chunkType === 'tEXt') {
                const textData = bytes.slice(offset, offset + length);
                // 保存所有tEXt块以备后用
                allTextChunks.push({
                    data: textData,
                    offset: offset,
                    length: length
                });

                data = parseTextChunk(textData);
                if (data && isCharacterData(data)) {
                    return data;
                }
            } else if (chunkType === 'zTXt') {
                const compressedData = bytes.slice(offset, offset + length);
                data = parseCompressedTextChunk(compressedData);
                if (data && isCharacterData(data)) {
                    return data;
                }
            }
        } catch (e) {
            console.error(`解析 ${chunkType} 块失败:`, e);
        }

        offset += length + 4; // 移动到下一个块
    }

    // 如果没有找到有效的角色卡数据，尝试处理所有收集到的tEXt块
    if (allTextChunks.length > 0) {
        console.log(`尝试处理 ${allTextChunks.length} 个tEXt块...`);

        // 优先处理ccv3块
        const ccv3Chunks = allTextChunks.filter(chunk => {
            const keywordEnd = findNullTerminator(chunk.data);
            const keyword = new TextDecoder().decode(chunk.data.slice(0, keywordEnd));
            return keyword === 'ccv3';
        });

        if (ccv3Chunks.length > 0) {
            console.log("找到ccv3块，优先处理...");
            for (const chunk of ccv3Chunks) {
                try {
                    // 尝试多种解码方式
                    const data = await tryMultipleDecodingMethods(chunk.data);
                    if (data && isCharacterData(data)) {
                        return data;
                    }
                } catch (e) {
                    console.error("处理ccv3块失败:", e);
                }
            }
        }

        // 尝试处理所有块
        for (const chunk of allTextChunks) {
            try {
                // 尝试多种解码方式
                const data = await tryMultipleDecodingMethods(chunk.data);
                if (data && isCharacterData(data)) {
                    return data;
                }
            } catch (e) {
                console.error("处理tEXt块失败:", e);
            }
        }
    }

    return null;
};

// 尝试备用解析方法
export const tryAlternativeMethods = async (bytes, fileName) => {
    console.log("尝试备用解析方法...");

    // 方法1: 在整个文件中搜索JSON数据
    try {
        const fullText = new TextDecoder().decode(bytes);
        const jsonRegex = /\{[\s\S]*"name"[\s\S]*"description"[\s\S]*\}/g;
        const matches = fullText.match(jsonRegex);

        if (matches) {
            console.log(`找到 ${matches.length} 个可能的JSON匹配项`);

            for (const match of matches) {
                try {
                    const data = JSON.parse(match);
                    if (isCharacterData(data)) {
                        console.log("备用方法1成功: 文本搜索JSON");
                        return data;
                    }
                } catch (e) {
                    // 继续尝试下一个匹配项
                }
            }
        }
    } catch (e) {
        console.error("备用方法1失败:", e);
    }

    // 方法2: 搜索Base64编码的JSON
    try {
        const fullText = new TextDecoder().decode(bytes);
        // 查找可能的Base64编码（以eyJ开头，这是{"的Base64编码）
        const base64Regex = /eyJ[A-Za-z0-9+/=]{20,}/g;
        const matches = fullText.match(base64Regex);

        if (matches) {
            console.log(`找到 ${matches.length} 个可能的Base64编码匹配项`);

            for (const match of matches) {
                try {
                    const decodedContent = atob(match);
                    const data = JSON.parse(decodedContent);
                    if (isCharacterData(data)) {
                        console.log("备用方法2成功: Base64编码搜索");
                        return data;
                    }
                } catch (e) {
                    // 继续尝试下一个匹配项
                }
            }
        }
    } catch (e) {
        console.error("备用方法2失败:", e);
    }

    // 方法3: 直接从文件名尝试解析
    try {
        if (fileName) {
            const nameMatch = fileName.match(/^(.+)\.png$/i);
            if (nameMatch) {
                const characterName = nameMatch[1];
                console.log(`尝试从文件名创建基本角色卡: ${characterName}`);

                // 创建一个最小的角色卡数据
                const basicCharacterData = {
                    name: characterName,
                    description: "从文件名自动生成的角色卡",
                    personality: "未知",
                    scenario: "未知",
                    first_mes: "你好，我是" + characterName,
                    mes_example: ""
                };

                if (isCharacterData(basicCharacterData)) {
                    console.log("备用方法3成功: 从文件名创建");
                    return basicCharacterData;
                }
            }
        }
    } catch (e) {
        console.error("备用方法3失败:", e);
    }

    return null;
};

// 从PNG文件提取块
export const extractPngChunks = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                const bytes = new Uint8Array(arrayBuffer);

                if (!isPng(bytes)) {
                    throw new Error('不是有效的PNG文件');
                }

                // 尝试多种方法解析数据
                let data = await findCharacterDataInChunks(bytes);

                // 如果常规方法失败，尝试备用方法
                if (!data) {
                    console.log("常规方法解析失败，尝试备用方法...");
                    data = await tryAlternativeMethods(bytes, file.name);
                }

                if (data) {
                    resolve(data);
                } else {
                    throw new Error('未找到角色卡数据');
                }
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
    });
};

// 计算CRC
export const calculateCRC = (data) => {
    let crc = 0xffffffff;
    const crcTable = makeCRCTable();
    
    for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    
    return crc ^ 0xffffffff;
};

// 创建CRC表
export const makeCRCTable = () => {
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

// 创建tEXt块
export const createTextChunk = (keyword, text) => {
    // 计算长度：关键字 + 分隔符(0) + 文本
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const length = keywordBytes.length + 1 + textBytes.length;
    
    // 创建块数据
    const chunk = new Uint8Array(4 + 4 + length + 4); // 长度(4) + 类型(4) + 数据(length) + CRC(4)
    
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
    
    // 计算CRC（仅针对类型和数据）
    const crc = calculateCRC(chunk.slice(4, 8 + length));
    
    // 设置CRC（大端序）
    chunk[8 + length] = (crc >> 24) & 0xff;
    chunk[8 + length + 1] = (crc >> 16) & 0xff;
    chunk[8 + length + 2] = (crc >> 8) & 0xff;
    chunk[8 + length + 3] = crc & 0xff;
    
    return chunk;
};

// 创建空的IEND块
export const createEmptyIendChunk = () => {
    // IEND块: 长度为0，类型为IEND，无数据，CRC为0xAE, 0x42, 0x60, 0x82
    const iendChunk = new Uint8Array([
        0, 0, 0, 0,             // 长度为0
        73, 69, 78, 68,         // "IEND"
        174, 66, 96, 130        // CRC
    ]);
    return iendChunk;
};

// 从PNG中提取所有需要的块（用于导出）
export const extractPngChunksForExport = (bytes) => {
    const chunks = {
        ihdr: null,
        others: [],
        iend: null
    };
    
    let offset = 8; // 跳过PNG签名
    
    try {
        while (offset < bytes.length - 12) {
            const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
                (bytes[offset + 2] << 8) | bytes[offset + 3];
            offset += 4;
            
            const chunkType = String.fromCharCode(
                bytes[offset], bytes[offset + 1],
                bytes[offset + 2], bytes[offset + 3]
            );
            
            const chunkStart = offset - 4;
            const chunkEnd = offset + 4 + length + 4; // 包括类型、数据和CRC
            
            // 检查是否超出数组范围
            if (chunkEnd > bytes.length) {
                console.warn(`块数据超出数组范围: ${chunkType}, 起始: ${chunkStart}, 结束: ${chunkEnd}, 数组长度: ${bytes.length}`);
                break;
            }
            
            // 分类保存不同类型的块
            if (chunkType === 'IHDR') {
                chunks.ihdr = bytes.slice(chunkStart, chunkEnd);
            } else if (chunkType === 'IEND') {
                chunks.iend = bytes.slice(chunkStart, chunkEnd);
                break; // 找到IEND后停止
            } else if (chunkType !== 'tEXt' && chunkType !== 'zTXt') {
                chunks.others.push(bytes.slice(chunkStart, chunkEnd));
            }
            
            offset = chunkEnd; // 移到下一个块
        }
        
        console.log(`提取了: IHDR=${chunks.ihdr ? '是' : '否'}, 其他块=${chunks.others.length}, IEND=${chunks.iend ? '是' : '否'}`);
        return chunks;
    } catch (err) {
        console.error("提取PNG块时出错:", err);
        return chunks;
    }
};

// 创建一个最小的PNG，仅包含角色卡数据
export const createMinimalPngWithCharacterData = (base64Data, keyword) => {
    console.log('创建最小PNG，仅包含角色卡数据...');
    
    // 如果base64Data不是Base64编码，需要先编码
    if (typeof base64Data === 'object') {
        base64Data = safeBase64EncodeInPngParser(JSON.stringify(base64Data));
    }
    
    // 创建一个1x1像素的透明PNG图像
    const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR块（1x1像素的透明PNG）
    const ihdrChunk = new Uint8Array([
        0, 0, 0, 13,           // 长度为13
        73, 72, 68, 82,        // "IHDR"
        0, 0, 0, 1,            // 宽度为1
        0, 0, 0, 1,            // 高度为1
        8,                     // 位深度
        6,                     // 颜色类型（RGBA）
        0,                     // 压缩方法
        0,                     // 过滤方法
        0,                     // 隔行扫描方法
        0, 0, 0, 0            // CRC（临时值）
    ]);
    
    // 计算IHDR的CRC
    const ihdrCrc = calculateCRC(ihdrChunk.slice(4, 17 + 4));
    ihdrChunk[21] = (ihdrCrc >> 24) & 0xff;
    ihdrChunk[22] = (ihdrCrc >> 16) & 0xff;
    ihdrChunk[23] = (ihdrCrc >> 8) & 0xff;
    ihdrChunk[24] = ihdrCrc & 0xff;
    
    // 创建一个透明像素的IDAT块
    const idatData = new Uint8Array([
        120, 156, 99, 96, 0, 0, 0, 2, 0, 1
    ]);
    const idatChunk = new Uint8Array(4 + 4 + idatData.length + 4);
    // 设置IDAT长度
    idatChunk[0] = 0;
    idatChunk[1] = 0;
    idatChunk[2] = 0;
    idatChunk[3] = idatData.length;
    // 设置IDAT类型
    idatChunk[4] = 73; // I
    idatChunk[5] = 68; // D
    idatChunk[6] = 65; // A
    idatChunk[7] = 84; // T
    // 设置IDAT数据
    for (let i = 0; i < idatData.length; i++) {
        idatChunk[8 + i] = idatData[i];
    }
    // 计算并设置CRC
    const idatCrc = calculateCRC(idatChunk.slice(4, 8 + idatData.length));
    idatChunk[8 + idatData.length] = (idatCrc >> 24) & 0xff;
    idatChunk[8 + idatData.length + 1] = (idatCrc >> 16) & 0xff;
    idatChunk[8 + idatData.length + 2] = (idatCrc >> 8) & 0xff;
    idatChunk[8 + idatData.length + 3] = idatCrc & 0xff;
    
    // 创建角色卡数据块
    const textChunk = createTextChunk(keyword, base64Data);
    
    // 创建IEND块
    const iendChunk = createEmptyIendChunk();
    
    // 计算总长度并创建最终PNG
    const totalLength = pngSignature.length + ihdrChunk.length + idatChunk.length + textChunk.length + iendChunk.length;
    const pngData = new Uint8Array(totalLength);
    
    // 组装PNG
    let pos = 0;
    pngData.set(pngSignature, pos); pos += pngSignature.length;
    pngData.set(ihdrChunk, pos); pos += ihdrChunk.length;
    pngData.set(idatChunk, pos); pos += idatChunk.length;
    pngData.set(textChunk, pos); pos += textChunk.length;
    pngData.set(iendChunk, pos);
    
    console.log('最小PNG创建完成，总大小:', pngData.length);
    return pngData;
};

// 修改PNG数据添加角色卡信息
export const modifyPngWithCharacterData = async (bytes, characterData, updateCharacterData) => {
    console.log('开始修改PNG数据，添加角色卡信息');
    
    // 确保数据已经是最新的（如果提供了更新函数）
    if (typeof updateCharacterData === 'function') {
        updateCharacterData();
    }
    
    // 准备数据 - 确保是完整的、最新的角色卡数据
    console.log('准备角色卡JSON数据');
    // 使用深拷贝确保不会有引用问题
    const cardData = JSON.parse(JSON.stringify(characterData));
    console.log('角色卡数据:', 
        '名称:', cardData.data?.name || cardData.name, 
        '版本:', cardData.spec || '未知');
    
    const jsonData = JSON.stringify(cardData);
    console.log('JSON数据长度:', jsonData.length);
    
    // 使用安全的UTF-8编码方式
    const base64Data = safeBase64EncodeInPngParser(jsonData);
    
    // 创建新的PNG数据 - 采用重构策略直接从头构建PNG
    try {
        // 从原始PNG提取必要的图像数据
        const chunks = extractPngChunksForExport(bytes);
        if (!chunks.ihdr) {
            throw new Error('未找到IHDR块，无法创建有效的PNG');
        }

        // 创建新的tEXt块
        const keyword = cardData.spec?.includes('v3') ? 'ccv3' : 'chara';
        console.log('使用关键字:', keyword);
        
        const textChunk = createTextChunk(keyword, base64Data);
        
        // 构建新的PNG
        const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        
        // 计算新PNG的总长度
        let totalLength = pngSignature.length + chunks.ihdr.length;
        
        // 添加所有图像相关的块（除tEXt/zTXt/IEND外）
        for (const chunk of chunks.others) {
            totalLength += chunk.length;
        }
        
        // 添加自定义数据块和IEND块
        totalLength += textChunk.length;
        totalLength += chunks.iend ? chunks.iend.length : 12; // 如果没有IEND，预留12字节
        
        console.log('新PNG数据总长度估计:', totalLength);
        
        // 创建新的PNG数据
        const newPngData = new Uint8Array(totalLength);
        let pos = 0;
        
        // 添加PNG签名
        newPngData.set(pngSignature, pos);
        pos += pngSignature.length;
        
        // 添加IHDR块
        newPngData.set(chunks.ihdr, pos);
        pos += chunks.ihdr.length;
        
        // 添加其他图像相关的块
        for (const chunk of chunks.others) {
            newPngData.set(chunk, pos);
            pos += chunk.length;
        }
        
        // 添加角色卡数据块
        newPngData.set(textChunk, pos);
        pos += textChunk.length;
        
        // 添加IEND块
        if (chunks.iend) {
            newPngData.set(chunks.iend, pos);
        } else {
            // 如果没有找到IEND，手动创建一个
            const iendChunk = createEmptyIendChunk();
            newPngData.set(iendChunk, pos);
        }
        
        console.log('PNG数据修改完成');
        return newPngData;
    } catch (err) {
        console.error("构建PNG数据失败:", err);
        
        // 创建一个全新的最小PNG，仅包含角色卡数据
        console.log("尝试创建最小PNG文件...");
        const keyword = cardData.spec?.includes('v3') ? 'ccv3' : 'chara';
        const minimalPng = createMinimalPngWithCharacterData(base64Data, keyword);
        return minimalPng;
    }
}; 