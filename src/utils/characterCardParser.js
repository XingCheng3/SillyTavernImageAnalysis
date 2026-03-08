/**
 * SillyTavern Compatible Character Card Parser & Exporter
 * 基于SillyTavern源码的角色卡解析与导出封装模块
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

const SUPPORTED_SPECS = {
    V1: 'chara_card_v1',
    V2: 'chara_card_v2',
    V3: 'chara_card_v3',
};

const DEFAULT_WORLD_INFO_ENTRY = {
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
    extensions: {
        position: 1,
        depth: 4,
        display_index: 0,
        probability: 100,
        useProbability: true,
        selectiveLogic: 0,
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
        role: 0,
        vectorized: false,
        sticky: null,
        cooldown: null,
        delay: null,
    },
};

function isPNG(data) {
    if (!data || data.length < 8) return false;

    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (data[i] !== PNG_SIGNATURE[i]) {
            return false;
        }
    }
    return true;
}

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

function createTextChunk(keyword, text) {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const length = keywordBytes.length + 1 + textBytes.length;

    const chunk = new Uint8Array(4 + 4 + length + 4);

    chunk[0] = (length >> 24) & 0xff;
    chunk[1] = (length >> 16) & 0xff;
    chunk[2] = (length >> 8) & 0xff;
    chunk[3] = length & 0xff;

    chunk[4] = 116;
    chunk[5] = 69;
    chunk[6] = 88;
    chunk[7] = 116;

    let offset = 8;
    for (let i = 0; i < keywordBytes.length; i++) {
        chunk[offset++] = keywordBytes[i];
    }
    chunk[offset++] = 0;
    for (let i = 0; i < textBytes.length; i++) {
        chunk[offset++] = textBytes[i];
    }

    const crc = calculateCRC32(chunk.slice(4, 8 + length));

    chunk[8 + length] = (crc >> 24) & 0xff;
    chunk[8 + length + 1] = (crc >> 16) & 0xff;
    chunk[8 + length + 2] = (crc >> 8) & 0xff;
    chunk[8 + length + 3] = crc & 0xff;

    return chunk;
}

function safeBase64Encode(text) {
    try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);

        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }

        return btoa(binaryString);
    } catch (error) {
        console.error('Base64编码失败:', error);
        return btoa(unescape(encodeURIComponent(text)));
    }
}

function safeBase64Decode(base64String) {
    try {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
    } catch (error) {
        console.error('Base64解码失败:', error);
        return atob(base64String);
    }
}

function extractDataFromPNG(data, identifier = 'chara') {
    let uint8 = new Uint8Array(4);
    let uint32 = new Uint32Array(uint8.buffer);

    if (!isPNG(data)) {
        return null;
    }

    let ended = false;
    const chunks = [];
    let idx = 8;

    while (idx < data.length) {
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        const length = uint32[0] + 4;
        const chunk = new Uint8Array(length);
        chunk[0] = data[idx++];
        chunk[1] = data[idx++];
        chunk[2] = data[idx++];
        chunk[3] = data[idx++];

        const name = (
            String.fromCharCode(chunk[0]) +
            String.fromCharCode(chunk[1]) +
            String.fromCharCode(chunk[2]) +
            String.fromCharCode(chunk[3])
        );

        if (name === 'IEND') {
            ended = true;
            chunks.push({ name, data: new Uint8Array(0) });
            break;
        }

        for (let i = 4; i < length; i++) {
            chunk[i] = data[idx++];
        }

        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        chunks.push({
            name,
            data: new Uint8Array(chunk.buffer.slice(4)),
        });
    }

    if (!ended) {
        console.warn('.png文件提前结束: 没有找到IEND头');
    }

    const identifiers = identifier === 'chara' ? ['ccv3', 'chara'] : [identifier];

    for (const id of identifiers) {
        const found = chunks.filter(x => (
            x.name === 'tEXt'
            && x.data.length > id.length
            && x.data.slice(0, id.length).every((v, i) => String.fromCharCode(v) === id[i])
        ));

        if (found.length > 0) {
            try {
                const bytes = found[0].data;
                let b64buf = '';

                for (let i = id.length + 1; i < bytes.length; i++) {
                    b64buf += String.fromCharCode(bytes[i]);
                }

                const decodedText = safeBase64Decode(b64buf);
                return JSON.parse(decodedText);
            } catch (e) {
                console.warn(`解码${id}块时出错:`, e);
                try {
                    const bytes = found[0].data;
                    let b64buf = '';
                    for (let i = id.length + 1; i < bytes.length; i++) {
                        b64buf += String.fromCharCode(bytes[i]);
                    }
                    return JSON.parse(atob(b64buf));
                } catch (fallbackError) {
                    console.warn('备用解码方法也失败:', fallbackError);
                    continue;
                }
            }
        }
    }

    return null;
}

function extractPNGChunks(data) {
    const chunks = {
        ihdr: null,
        others: [],
        iend: null,
    };

    let idx = 8;
    const uint8 = new Uint8Array(4);
    const uint32 = new Uint32Array(uint8.buffer);

    try {
        while (idx < data.length - 12) {
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
                data[idx], data[idx + 1], data[idx + 2], data[idx + 3],
            );

            const chunkStart = idx - 4;
            const chunkEnd = idx + 4 + length + 4;

            if (chunkType === 'IHDR') {
                chunks.ihdr = data.slice(chunkStart, chunkEnd);
            } else if (chunkType === 'IEND') {
                chunks.iend = data.slice(chunkStart, chunkEnd);
                break;
            } else {
                let keep = true;
                if (chunkType === 'tEXt' || chunkType === 'zTXt') {
                    try {
                        const dataStart = idx + 4;
                        const dataEnd = dataStart + length;
                        const chunkData = data.slice(dataStart, dataEnd);
                        const nulIndex = chunkData.indexOf(0);
                        if (nulIndex > 0) {
                            const keyword = String.fromCharCode.apply(null, Array.from(chunkData.slice(0, nulIndex))).toLowerCase();
                            if (keyword === 'chara' || keyword === 'ccv3') {
                                keep = false;
                            }
                        }
                    } catch {
                        keep = true;
                    }
                }
                if (keep) {
                    chunks.others.push(data.slice(chunkStart, chunkEnd));
                }
            }

            idx = chunkEnd;
        }

        return chunks;
    } catch (err) {
        console.error('提取PNG块时出错:', err);
        return chunks;
    }
}

function createMinimalPNG(base64Chara, base64V3) {
    const pngSignature = new Uint8Array(PNG_SIGNATURE);

    const ihdrData = new Uint8Array([
        0, 0, 0, 1,
        0, 0, 0, 1,
        8,
        6,
        0,
        0,
        0,
    ]);

    const ihdrChunk = new Uint8Array(4 + 4 + ihdrData.length + 4);
    ihdrChunk[3] = ihdrData.length;
    ihdrChunk[4] = 73; ihdrChunk[5] = 72; ihdrChunk[6] = 68; ihdrChunk[7] = 82;
    ihdrChunk.set(ihdrData, 8);
    const ihdrCrc = calculateCRC32(ihdrChunk.slice(4, 8 + ihdrData.length));
    ihdrChunk[8 + ihdrData.length] = (ihdrCrc >> 24) & 0xff;
    ihdrChunk[8 + ihdrData.length + 1] = (ihdrCrc >> 16) & 0xff;
    ihdrChunk[8 + ihdrData.length + 2] = (ihdrCrc >> 8) & 0xff;
    ihdrChunk[8 + ihdrData.length + 3] = ihdrCrc & 0xff;

    const idatData = new Uint8Array([120, 156, 99, 96, 0, 0, 0, 2, 0, 1]);
    const idatChunk = new Uint8Array(4 + 4 + idatData.length + 4);
    idatChunk[3] = idatData.length;
    idatChunk[4] = 73; idatChunk[5] = 68; idatChunk[6] = 65; idatChunk[7] = 84;
    idatChunk.set(idatData, 8);
    const idatCrc = calculateCRC32(idatChunk.slice(4, 8 + idatData.length));
    idatChunk[8 + idatData.length] = (idatCrc >> 24) & 0xff;
    idatChunk[8 + idatData.length + 1] = (idatCrc >> 16) & 0xff;
    idatChunk[8 + idatData.length + 2] = (idatCrc >> 8) & 0xff;
    idatChunk[8 + idatData.length + 3] = idatCrc & 0xff;

    const textChunkChara = createTextChunk('chara', base64Chara);
    const textChunkV3 = createTextChunk('ccv3', base64V3);
    const iendChunk = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

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

function isValidCharacterData(data) {
    if (!data || typeof data !== 'object') return false;
    const hasCharacterInfo = data.name || data.data?.name;

    if (data.spec && data.spec.includes('v3')) {
        return hasCharacterInfo && (data.data || data.lore !== undefined);
    }

    if (data.spec && data.spec.includes('v2')) {
        return hasCharacterInfo && data.data;
    }

    return hasCharacterInfo;
}

function normalizeCharacterData(rawData) {
    if (!isValidCharacterData(rawData)) {
        throw new Error('无效的角色卡数据');
    }

    const data = JSON.parse(JSON.stringify(rawData));

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

    if (!data.data && data.name) {
        const characterData = { ...data };
        delete characterData.spec;
        delete characterData.spec_version;
        data.data = characterData;
    }

    const charData = data.data || data;
    const isV3 = spec && spec.includes('v3');

    if (isV3) {
        if (Array.isArray(charData.greetings) && charData.greetings.length > 0) {
            if (!charData.first_mes) {
                charData.first_mes = charData.greetings[0];
            }
            if (!charData.first_message) {
                charData.first_message = charData.greetings[0];
            }
            if (charData.greetings.length > 1) {
                charData.alternate_greetings = charData.greetings.slice(1);
            }
        } else if (charData.first_mes || charData.first_message) {
            const firstMessage = charData.first_mes || charData.first_message;
            charData.greetings = [firstMessage];
            charData.first_mes = firstMessage;
            charData.first_message = firstMessage;
            if (charData.alternate_greetings?.length > 0) {
                charData.greetings = charData.greetings.concat(charData.alternate_greetings);
            }
        }
    } else {
        if (charData.first_mes && !charData.first_message) {
            charData.first_message = charData.first_mes;
        }
        if (charData.first_message && !charData.first_mes) {
            charData.first_mes = charData.first_message;
        }
        if (Array.isArray(charData.greetings) && charData.greetings.length > 0) {
            charData.first_mes = charData.greetings[0];
            charData.first_message = charData.greetings[0];
            if (charData.greetings.length > 1) {
                charData.alternate_greetings = charData.greetings.slice(1);
            }
        }
    }

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

    if (isV3 && Array.isArray(charData.lore)) {
        syncCharacterBookFromLore(charData);
    }

    return data;
}

function normalizeNullable(value) {
    return value === undefined ? null : value;
}

function normalizeStringArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }
    return [];
}

function getEntryExtensions(entry = {}, fallbackIndex = 0) {
    return {
        position: entry.position === 'before_char' ? 0 : 1,
        depth: entry.depth ?? 4,
        display_index: entry.displayIndex ?? fallbackIndex,
        probability: entry.probability ?? 100,
        useProbability: entry.useProbability ?? true,
        selectiveLogic: entry.selectiveLogic ?? 0,
        group: entry.group ?? '',
        group_override: entry.groupOverride ?? false,
        group_weight: entry.groupWeight ?? 100,
        scan_depth: normalizeNullable(entry.scanDepth),
        case_sensitive: normalizeNullable(entry.caseSensitive),
        match_whole_words: normalizeNullable(entry.matchWholeWords),
        use_group_scoring: normalizeNullable(entry.useGroupScoring),
        exclude_recursion: entry.excludeRecursion ?? false,
        prevent_recursion: entry.preventRecursion ?? false,
        delay_until_recursion: entry.delayUntilRecursion ?? false,
        automation_id: entry.automationId ?? '',
        role: entry.role ?? 0,
        vectorized: entry.vectorized ?? false,
        sticky: normalizeNullable(entry.sticky),
        cooldown: normalizeNullable(entry.cooldown),
        delay: normalizeNullable(entry.delay),
        ...(entry.extensions || {}),
    };
}

function normalizeEditableBookEntry(entry, index) {
    const keys = normalizeStringArray(entry.keys ?? entry.keysText);
    const secondaryKeys = normalizeStringArray(entry.secondary_keys ?? entry.keysecondary ?? entry.secondaryKeys);
    const extensions = getEntryExtensions(entry, index);

    return {
        id: entry.id ?? entry.uid ?? index,
        keys,
        secondary_keys: secondaryKeys,
        keysecondary: secondaryKeys,
        name: entry.name ?? entry.comment ?? `条目 ${index + 1}`,
        comment: entry.comment ?? entry.name ?? `条目 ${index + 1}`,
        content: entry.content ?? '',
        enabled: entry.enabled !== false,
        constant: entry.constant ?? false,
        selective: entry.selective ?? false,
        priority: entry.priority ?? entry.insertion_order ?? entry.order ?? 0,
        insertion_order: entry.insertion_order ?? entry.priority ?? entry.order ?? 0,
        position: entry.position === 'before_char' ? 'before_char' : 'after_char',
        depth: extensions.depth,
        displayIndex: extensions.display_index ?? index,
        probability: extensions.probability ?? 100,
        useProbability: extensions.useProbability ?? true,
        selectiveLogic: extensions.selectiveLogic ?? 0,
        group: extensions.group ?? '',
        groupOverride: extensions.group_override ?? false,
        groupWeight: extensions.group_weight ?? 100,
        scanDepth: normalizeNullable(extensions.scan_depth),
        caseSensitive: normalizeNullable(extensions.case_sensitive),
        matchWholeWords: normalizeNullable(extensions.match_whole_words),
        useGroupScoring: normalizeNullable(extensions.use_group_scoring),
        excludeRecursion: extensions.exclude_recursion ?? false,
        preventRecursion: extensions.prevent_recursion ?? false,
        delayUntilRecursion: extensions.delay_until_recursion ?? false,
        automationId: extensions.automation_id ?? '',
        role: extensions.role ?? 0,
        vectorized: extensions.vectorized ?? false,
        sticky: normalizeNullable(extensions.sticky),
        cooldown: normalizeNullable(extensions.cooldown),
        delay: normalizeNullable(extensions.delay),
        keysText: keys.join(', '),
        extensions,
    };
}

function bookEntryToCharacterBookEntry(entry, index) {
    const normalized = normalizeEditableBookEntry(entry, index);

    return {
        id: normalized.id,
        keys: normalized.keys,
        secondary_keys: normalized.secondary_keys,
        comment: normalized.comment,
        content: normalized.content,
        constant: normalized.constant,
        selective: normalized.selective,
        insertion_order: normalized.insertion_order,
        enabled: normalized.enabled,
        position: normalized.position,
        extensions: { ...normalized.extensions },
    };
}

function bookEntryToLoreEntry(entry, index) {
    const normalized = normalizeEditableBookEntry(entry, index);

    return {
        id: normalized.id,
        name: normalized.name,
        comment: normalized.comment,
        keys: normalized.keys,
        secondary_keys: normalized.secondary_keys,
        content: normalized.content,
        enabled: normalized.enabled,
        selective: normalized.selective,
        constant: normalized.constant,
        insertion_order: normalized.insertion_order,
        position: normalized.position,
        extensions: { ...normalized.extensions },
    };
}

function convertCharacterBook(characterBook) {
    if (!characterBook || !characterBook.entries) {
        return { entries: {}, originalData: characterBook };
    }

    const result = { entries: {}, originalData: characterBook };

    characterBook.entries.forEach((entry, index) => {
        const normalized = normalizeEditableBookEntry(entry, index);
        result.entries[normalized.id] = {
            ...DEFAULT_WORLD_INFO_ENTRY,
            uid: normalized.id,
            key: normalized.keys,
            keysecondary: normalized.secondary_keys,
            comment: normalized.comment,
            content: normalized.content,
            constant: normalized.constant,
            selective: normalized.selective,
            order: normalized.insertion_order,
            position: normalized.position === 'before_char' ? 0 : 1,
            excludeRecursion: normalized.excludeRecursion,
            preventRecursion: normalized.preventRecursion,
            delayUntilRecursion: normalized.delayUntilRecursion,
            disable: !normalized.enabled,
            addMemo: !!normalized.comment,
            displayIndex: normalized.displayIndex,
            probability: normalized.probability,
            useProbability: normalized.useProbability,
            depth: normalized.depth,
            selectiveLogic: normalized.selectiveLogic,
            group: normalized.group,
            groupOverride: normalized.groupOverride,
            groupWeight: normalized.groupWeight,
            scanDepth: normalized.scanDepth,
            caseSensitive: normalized.caseSensitive,
            matchWholeWords: normalized.matchWholeWords,
            useGroupScoring: normalized.useGroupScoring,
            automationId: normalized.automationId,
            role: normalized.role,
            vectorized: normalized.vectorized,
            sticky: normalized.sticky,
            cooldown: normalized.cooldown,
            delay: normalized.delay,
            extensions: normalized.extensions,
        };
    });

    return result;
}

function buildCharacterBookMetadata(existingBook = {}) {
    return {
        name: existingBook.name || '世界书',
        description: existingBook.description || '',
        scan_depth: existingBook.scan_depth ?? 5,
        token_budget: existingBook.token_budget ?? 2048,
        recursive_scanning: existingBook.recursive_scanning ?? false,
        extensions: existingBook.extensions || {},
    };
}

function resolveLorebookEntries(charData = {}) {
    if (Array.isArray(charData.book_entries)) {
        return charData.book_entries.map((entry, index) => normalizeEditableBookEntry(entry, index));
    }

    if (Array.isArray(charData.lore)) {
        return charData.lore.map((entry, index) => normalizeEditableBookEntry(entry, index));
    }

    if (Array.isArray(charData.character_book?.entries)) {
        return charData.character_book.entries.map((entry, index) => normalizeEditableBookEntry(entry, index));
    }

    return [];
}

function syncCharacterBookFromLore(charData = {}) {
    if (!Array.isArray(charData.lore)) {
        return;
    }

    const loreEntries = charData.lore.map((entry, index) => normalizeEditableBookEntry(entry, index));
    const existingBook = buildCharacterBookMetadata(charData.character_book || {});

    charData.character_book = {
        ...existingBook,
        entries: loreEntries.map((entry, index) => bookEntryToCharacterBookEntry(entry, index)),
    };
}

function buildV3PayloadFromExportData(exportData) {
    const v3Payload = JSON.parse(JSON.stringify(exportData));
    v3Payload.spec = SUPPORTED_SPECS.V3;
    v3Payload.spec_version = '3.0';
    return v3Payload;
}

class CharacterCardParser {
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

    static async parseFromBuffer(buffer) {
        const bytes = new Uint8Array(buffer);

        if (!isPNG(bytes)) {
            throw new Error('不是有效的PNG文件');
        }

        const rawData = extractDataFromPNG(bytes, 'chara');

        if (!rawData) {
            throw new Error('PNG文件中未找到角色卡数据');
        }

        const normalizedData = normalizeCharacterData(rawData);

        if (normalizedData.data?.character_book) {
            normalizedData.worldInfo = convertCharacterBook(normalizedData.data.character_book);
        }

        return {
            success: true,
            data: normalizedData,
            metadata: {
                spec: normalizedData.spec,
                hasWorldBook: !!(normalizedData.data?.character_book?.entries?.length || normalizedData.data?.lore?.length),
                version: this.getVersionFromSpec(normalizedData.spec),
            },
        };
    }

    static async parseFromBase64(base64String) {
        try {
            const base64Data = base64String.replace(/^data:image\/png;base64,/, '');
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

    static parseFromJson(rawJson) {
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        const normalizedData = normalizeCharacterData(parsed);

        if (normalizedData.data?.character_book) {
            normalizedData.worldInfo = convertCharacterBook(normalizedData.data.character_book);
        }

        return {
            success: true,
            data: normalizedData,
            metadata: {
                spec: normalizedData.spec,
                hasWorldBook: !!(normalizedData.data?.character_book?.entries?.length || normalizedData.data?.lore?.length),
                version: this.getVersionFromSpec(normalizedData.spec),
                sourceType: 'json',
            },
        };
    }

    static exportToPNG(characterData, originalPngData = null) {
        try {
            if (!isValidCharacterData(characterData)) {
                throw new Error('无效的角色卡数据');
            }

            const exportData = this.prepareExportData(characterData);
            const charaJsonString = JSON.stringify(exportData);
            const v3Payload = buildV3PayloadFromExportData(exportData);
            const v3JsonString = JSON.stringify(v3Payload);
            const base64Chara = safeBase64Encode(charaJsonString);
            const base64V3 = safeBase64Encode(v3JsonString);

            if (originalPngData && originalPngData.length > 0) {
                return this.rebuildPNGWithData(originalPngData, base64Chara, base64V3);
            }

            return createMinimalPNG(base64Chara, base64V3);
        } catch (error) {
            console.error('导出失败:', error);
            throw new Error(`导出角色卡失败: ${error.message}`);
        }
    }

    static rebuildPNGWithData(originalData, base64Chara, base64V3) {
        try {
            const chunks = extractPNGChunks(originalData);

            if (!chunks.ihdr) {
                throw new Error('未找到IHDR块，无法重建PNG');
            }

            const textChunkChara = createTextChunk('chara', base64Chara);
            const textChunkV3 = createTextChunk('ccv3', base64V3);

            let totalLength = PNG_SIGNATURE.length + chunks.ihdr.length;
            chunks.others.forEach(chunk => totalLength += chunk.length);
            totalLength += textChunkChara.length;
            totalLength += textChunkV3.length;
            totalLength += chunks.iend ? chunks.iend.length : 12;

            const newPngData = new Uint8Array(totalLength);
            let pos = 0;

            newPngData.set(PNG_SIGNATURE, pos);
            pos += PNG_SIGNATURE.length;

            newPngData.set(chunks.ihdr, pos);
            pos += chunks.ihdr.length;

            chunks.others.forEach(chunk => {
                newPngData.set(chunk, pos);
                pos += chunk.length;
            });

            newPngData.set(textChunkChara, pos);
            pos += textChunkChara.length;
            newPngData.set(textChunkV3, pos);
            pos += textChunkV3.length;

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

    static prepareExportData(characterData) {
        const exportData = JSON.parse(JSON.stringify(characterData));
        const isV3 = exportData.spec?.includes('v3');

        if (isV3) {
            exportData.spec = SUPPORTED_SPECS.V3;
            exportData.spec_version = exportData.spec_version || '3.0';
        } else if (exportData.spec?.includes('v2')) {
            exportData.spec = SUPPORTED_SPECS.V2;
            exportData.spec_version = exportData.spec_version || '2.0';
        } else if (exportData.spec?.includes('v1')) {
            exportData.spec = SUPPORTED_SPECS.V1;
        }

        if (!exportData.data && exportData.name) {
            const wrapped = { ...exportData };
            delete wrapped.spec;
            delete wrapped.spec_version;
            exportData.data = wrapped;
        }

        const charData = exportData.data || exportData;

        const primaryGreeting = charData.first_message || charData.first_mes || charData.greetings?.[0] || '';
        const alternateGreetings = Array.isArray(charData.alternate_greetings)
            ? charData.alternate_greetings.filter(item => item && item.trim())
            : [];

        if (isV3) {
            charData.greetings = primaryGreeting
                ? [primaryGreeting, ...alternateGreetings]
                : [...alternateGreetings];
            charData.first_mes = primaryGreeting;
            delete charData.first_message;
            delete charData.alternate_greetings;
        } else {
            charData.first_mes = primaryGreeting;
            charData.alternate_greetings = alternateGreetings;
            delete charData.first_message;
            delete charData.greetings;
        }

        const exampleDialog = charData.message_example || charData.mes_example || charData.dialogue || '';
        charData.mes_example = exampleDialog;
        if (isV3) {
            charData.message_example = exampleDialog;
        } else {
            delete charData.message_example;
        }
        delete charData.dialogue;

        const hasEditableBookEntries = Array.isArray(charData.book_entries);
        const normalizedBookEntries = resolveLorebookEntries(charData);

        const shouldWriteBook = hasEditableBookEntries || !!charData.character_book || Array.isArray(charData.lore);
        if (shouldWriteBook) {
            const existingBook = buildCharacterBookMetadata(charData.character_book || {});
            charData.character_book = {
                ...existingBook,
                entries: normalizedBookEntries.map((entry, index) => bookEntryToCharacterBookEntry(entry, index)),
            };

            if (isV3) {
                charData.lore = normalizedBookEntries.map((entry, index) => bookEntryToLoreEntry(entry, index));
            } else {
                delete charData.lore;
            }
        }

        delete charData.book_entries;

        return exportData;
    }

    static getVersionFromSpec(spec) {
        if (!spec) return 'unknown';
        if (spec.includes('v3')) return 'v3';
        if (spec.includes('v2')) return 'v2';
        if (spec.includes('v1')) return 'v1';
        return 'unknown';
    }

    static validateCharacterCard(data) {
        const errors = [];
        const warnings = [];

        if (!data) {
            errors.push('数据为空');
            return { valid: false, errors, warnings };
        }

        const charData = data.data || data;

        if (!charData.name) {
            errors.push('缺少角色名称');
        }

        if (!charData.description && !charData.personality) {
            warnings.push('没有角色描述或性格设定');
        }

        if (charData.character_book?.entries) {
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
            warnings,
        };
    }
}

const CharacterCardUtils = {
    async parseFile(file) {
        return await CharacterCardParser.parseFromFile(file);
    },

    async parseBase64(base64) {
        return await CharacterCardParser.parseFromBase64(base64);
    },

    parseJson(rawJson) {
        return CharacterCardParser.parseFromJson(rawJson);
    },

    exportToPNG(characterData, originalPng = null) {
        return CharacterCardParser.exportToPNG(characterData, originalPng);
    },

    validate(data) {
        return CharacterCardParser.validateCharacterCard(data);
    },

    normalize(rawData) {
        return normalizeCharacterData(rawData);
    },

    createTemplate(name = '新角色') {
        return {
            spec: SUPPORTED_SPECS.V2,
            spec_version: '2.0',
            data: {
                name,
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
                    entries: [],
                },
            },
        };
    },

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
    },
};

export default CharacterCardParser;

export {
    CharacterCardUtils,
    SUPPORTED_SPECS,
    DEFAULT_WORLD_INFO_ENTRY,
    isValidCharacterData,
    normalizeCharacterData,
    convertCharacterBook,
    normalizeEditableBookEntry,
    bookEntryToCharacterBookEntry,
    bookEntryToLoreEntry,
};
