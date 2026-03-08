<template>
    <div class="tab-pane">
        <div v-if="hasCharacterBook">
            <h3>世界书信息</h3>
            <div class="book-info">
                <div class="book-info-row">
                    <strong>名称:</strong>
                    <input type="text" v-if="editableData.character_book" v-model="editableData.character_book.name" class="editable-input" placeholder="世界书的名称" />
                    <input type="text" v-else disabled placeholder="未设置" class="editable-input" />
                </div>
                <div class="book-info-row">
                    <strong>描述:</strong>
                    <input type="text" v-if="editableData.character_book" v-model="editableData.character_book.description" class="editable-input" placeholder="简要描述世界书的内容和用途" />
                    <input type="text" v-else disabled placeholder="未设置" class="editable-input" />
                </div>
                <div class="book-info-row" v-if="!isV3 && editableData.character_book">
                    <strong>扫描深度:</strong>
                    <input type="number" v-model.number="editableData.character_book.scan_depth" class="editable-input" />
                </div>
                <div class="book-info-row" v-if="!isV3 && editableData.character_book">
                    <strong>Token预算:</strong>
                    <input type="number" v-model.number="editableData.character_book.token_budget" class="editable-input" />
                </div>
            </div>

            <div class="book-section">
                <div class="book-section-header">
                    <h3>条目列表 ({{ editableData.book_entries && editableData.book_entries.length || 0 }})</h3>
                    <div class="book-section-actions">
                        <button @click="$emit('open-batch-translate')" class="small-button" :disabled="!editableData.book_entries || editableData.book_entries.length === 0">
                            批量翻译条目
                        </button>
                        <button @click="$emit('add-entry')" class="small-button primary">添加新条目</button>
                    </div>
                </div>
            </div>
            
            <div v-if="editableData.book_entries && editableData.book_entries.length > 0">
                <div v-for="(entry, index) in editableData.book_entries" :key="index" class="book-entry">
                    <div class="entry-header">
                        <input type="text" v-model="entry.name" placeholder="为此条目起一个清晰的名称" class="editable-input" />
                        <div class="entry-actions">
                            <label class="toggle-switch">
                                <input type="checkbox" v-model="entry.enabled" />
                                <span class="slider"></span>
                                <span class="toggle-label">{{ entry.enabled ? '启用' : '禁用' }}</span>
                            </label>
                            <button @click="$emit('remove-entry', index)" class="small-button danger">删除</button>
                        </div>
                    </div>
                    <div class="entry-keys">
                        <strong>关键词:</strong>
                        <input type="text" v-model="entry.keysText" placeholder="输入触发关键词，用逗号分隔，例如：地名,人名,物品名" class="editable-input" @input="$emit('update-keys', entry)" />
                        <div class="keyword-tags" v-if="entry.keys && entry.keys.length > 0">
                            <span v-for="(key, kidx) in entry.keys" :key="kidx" class="keyword-tag">{{ key }}</span>
                        </div>
                    </div>
                    <div class="entry-content">
                        <textarea v-model="entry.content" class="editable-textarea" placeholder="输入该世界书条目的详细内容，描述相关的背景知识、设定或规则..."></textarea>
                    </div>
                    <div class="entry-options">
                        <div class="option-grid">
                            <div class="option-item">
                                <label>优先级:</label>
                                <input type="number" v-model.number="entry.priority" class="small-input" />
                            </div>
                            <div class="option-item">
                                <label>深度:</label>
                                <input type="number" v-model.number="entry.depth" class="small-input" min="0" max="100" />
                            </div>
                            <div class="option-item">
                                <label>位置:</label>
                                <select v-model="entry.position" class="small-input">
                                    <option value="after_char">角色后</option>
                                    <option value="before_char">角色前</option>
                                </select>
                            </div>
                            <div class="option-item">
                                <label>概率:</label>
                                <input type="number" v-model.number="entry.probability" class="small-input" min="0" max="100" />
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.selective" />
                                    <span class="slider"></span>
                                </label>
                                <span>有选择性的</span>
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.secondary" />
                                    <span class="slider"></span>
                                </label>
                                <span>次要</span>
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.constant" />
                                    <span class="slider"></span>
                                </label>
                                <span>常驻</span>
                            </div>
                            <div class="option-item toggle-option">
                                <label class="toggle-switch">
                                    <input type="checkbox" v-model="entry.useProbability" />
                                    <span class="slider"></span>
                                </label>
                                <span>使用概率</span>
                            </div>
                        </div>
                        
                        <div class="advanced-options">
                            <details>
                                <summary>高级选项</summary>
                                <div class="advanced-option-grid">
                                    <div class="option-item">
                                        <label>组名:</label>
                                        <input type="text" v-model="entry.group" class="small-input" placeholder="组名" />
                                    </div>
                                    <div class="option-item">
                                        <label>组权重:</label>
                                        <input type="number" v-model.number="entry.groupWeight" class="small-input" min="0" max="1000" />
                                    </div>
                                    <div class="option-item">
                                        <label>扫描深度:</label>
                                        <input type="number" v-model.number="entry.scanDepth" class="small-input" min="0" max="100" />
                                    </div>
                                    <div class="option-item">
                                        <label>自动化ID:</label>
                                        <input type="text" v-model="entry.automationId" class="small-input" placeholder="自动化ID" />
                                    </div>
                                    <div class="option-item toggle-option">
                                        <label class="toggle-switch">
                                            <input type="checkbox" v-model="entry.groupOverride" />
                                            <span class="slider"></span>
                                        </label>
                                        <span>组覆盖</span>
                                    </div>
                                    <div class="option-item toggle-option">
                                        <label class="toggle-switch">
                                            <input type="checkbox" v-model="entry.caseSensitive" />
                                            <span class="slider"></span>
                                        </label>
                                        <span>区分大小写</span>
                                    </div>
                                    <div class="option-item toggle-option">
                                        <label class="toggle-switch">
                                            <input type="checkbox" v-model="entry.matchWholeWords" />
                                            <span class="slider"></span>
                                        </label>
                                        <span>匹配整词</span>
                                    </div>
                                    <div class="option-item toggle-option">
                                        <label class="toggle-switch">
                                            <input type="checkbox" v-model="entry.excludeRecursion" />
                                            <span class="slider"></span>
                                        </label>
                                        <span>排除递归</span>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="no-entries-message">
                <p>世界书中没有条目，点击上方"添加新条目"按钮创建第一个条目。</p>
            </div>
        </div>
        <div v-else>
            <p>该角色卡没有包含世界书</p>
            <button @click="$emit('create-book')" class="action-button">创建世界书</button>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    editableData: { type: Object, required: true },
    hasCharacterBook: { type: Boolean, required: true },
    isV3: { type: Boolean, default: false },
});

defineEmits(['open-batch-translate', 'add-entry', 'remove-entry', 'create-book', 'update-keys']);
</script>

<style scoped>
/* 复用父级样式类名，无额外样式 */
</style>


