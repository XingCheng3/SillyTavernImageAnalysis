/**
 * 分批翻译辅助工具
 * 支持将大量条目拆分为多批次进行翻译
 */

/**
 * 将条目数组拆分为多个批次
 * @param {Array} items - 要拆分的条目数组
 * @param {number} batchCount - 批次数量
 * @returns {Array} - 拆分后的批次数组
 */
export function splitIntoBatches(items, batchCount) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    
    const batches = [];
    const batchSize = Math.ceil(items.length / Math.max(1, batchCount));
    
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
}

/**
 * 构建世界书条目的翻译标签文本
 * @param {Array} entries - 条目数组
 * @param {Array} selectedIndices - 选中的条目索引数组
 * @param {Array} fieldsToTranslate - 要翻译的字段数组
 * @param {object} editableData - 可编辑数据对象
 * @returns {object} - {taggedText, fieldMap, totalTags}
 */
export function buildBookTranslationTags(entries, selectedIndices, fieldsToTranslate, editableData) {
    let taggedText = '';
    const fieldMap = {};
    let tagIndex = 1;
    
    selectedIndices.forEach(entryIndex => {
        const entry = editableData.book_entries[entryIndex];
        
        fieldsToTranslate.forEach(field => {
            let textToTranslate = '';
            
            if (field === 'name' && entry.name) {
                textToTranslate = entry.name;
            } else if (field === 'keywords' && entry.keysText) {
                textToTranslate = entry.keysText;
            } else if (field === 'content' && entry.content) {
                textToTranslate = entry.content;
            }
            
            if (textToTranslate) {
                const tag = `TXT${tagIndex}`;
                taggedText += `<${tag}>${textToTranslate}</${tag}>\n\n`;
                fieldMap[tag] = { 
                    entryIndex, 
                    field, 
                    original: textToTranslate,
                    entryName: entry.name || `条目 ${entryIndex + 1}`
                };
                tagIndex++;
            }
        });
    });
    
    return {
        taggedText,
        fieldMap,
        totalTags: tagIndex - 1
    };
}

/**
 * 应用世界书翻译结果
 * @param {object} translationResults - 翻译结果对象
 * @param {object} editableData - 可编辑数据对象
 */
export function applyBookTranslations(translationResults, editableData) {
    const appliedCount = {
        name: 0,
        keywords: 0,
        content: 0
    };
    
    for (const [entryIndex, fields] of Object.entries(translationResults)) {
        const entry = editableData.book_entries[parseInt(entryIndex)];
        
        if (fields.name) {
            entry.name = fields.name;
            appliedCount.name++;
        }
        
        if (fields.keywords) {
            entry.keysText = fields.keywords;
            entry.keys = fields.keywords.split(',').map(k => k.trim()).filter(Boolean);
            appliedCount.keywords++;
        }
        
        if (fields.content) {
            entry.content = fields.content;
            appliedCount.content++;
        }
    }
    
    return appliedCount;
}

/**
 * 记录批次状态
 */
export class BatchState {
    constructor() {
        this.batches = [];
        this.currentBatch = 0;
        this.batchesData = []; // 保存每个批次的原始数据
    }
    
    /**
     * 初始化批次
     * @param {number} totalBatches - 总批次数
     * @param {Array} batchesIndices - 每个批次包含的条目索引数组
     */
    init(totalBatches, batchesIndices = []) {
        this.batches = Array(totalBatches).fill(null).map((_, i) => ({
            index: i,
            status: 'pending', // pending, translating, success, error
            results: null,
            error: null
        }));
        this.batchesData = batchesIndices; // 保存原始数据
        this.currentBatch = 0;
    }
    
    /**
     * 设置批次状态
     * @param {number} batchIndex - 批次索引
     * @param {string} status - 状态
     * @param {object} data - 附加数据
     */
    setBatchStatus(batchIndex, status, data = {}) {
        if (batchIndex < 0 || batchIndex >= this.batches.length) {
            return;
        }
        
        this.batches[batchIndex].status = status;
        
        if (data.results) {
            this.batches[batchIndex].results = data.results;
        }
        
        if (data.error) {
            this.batches[batchIndex].error = data.error;
        }
    }
    
    /**
     * 获取失败的批次索引数组
     * @returns {Array}
     */
    getFailedBatches() {
        return this.batches
            .filter(b => b.status === 'error')
            .map(b => b.index);
    }
    
    /**
     * 获取成功的批次数量
     * @returns {number}
     */
    getSuccessCount() {
        return this.batches.filter(b => b.status === 'success').length;
    }
    
    /**
     * 是否全部完成
     * @returns {boolean}
     */
    isAllCompleted() {
        return this.batches.every(b => b.status === 'success' || b.status === 'error');
    }
    
    /**
     * 获取指定批次的数据
     * @param {number} batchIndex - 批次索引
     * @returns {Array} - 该批次的条目索引数组
     */
    getBatchData(batchIndex) {
        return this.batchesData[batchIndex] || [];
    }
}

