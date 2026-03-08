<template>
    <div class="container">
        <div class="header-controls">
            <h1>角色卡解析翻译器</h1>
            <div class="header-buttons">
                <button @click="showPromptModal = true" class="config-button prompt-button" title="编辑翻译提示词">
                    <span class="button-icon">📝</span>
                    <span class="button-text">翻译提示词</span>
                </button>
                <button @click="showJailbreakModal = true" class="config-button jailbreak-button" title="编辑破限文本">
                    <span class="button-icon">🔓</span>
                    <span class="button-text">破限文本</span>
                </button>
                <router-link to="/stream" class="config-button stream-button" title="流式传输测试">
                    <span class="button-icon">🔄</span>
                    <span class="button-text">流式测试</span>
                </router-link>
                <button @click="showSettingsModal = true" class="settings-button">设置</button>
            </div>
        </div>

        <div class="upload-area">
            <label for="file-upload" class="upload-button">
                选择角色卡（PNG / JSON）
            </label>
            <input id="file-upload" type="file" accept="image/png,application/json,.json" @change="handleFileUpload" class="hidden" />
            <p v-if="fileName" class="file-name">已选择: {{ fileName }}</p>
        </div>

        <div v-if="isLoading" class="loading">
            <p>正在解析图片数据...</p>
        </div>

        <div v-if="error" class="error">
            <p>{{ error }}</p>
        </div>

        <div v-if="characterData" class="results">
            <h2>角色卡信息</h2>

            <!-- 角色卡基本信息展示区域 -->
            <div class="character-info-section">
                <div class="character-image">
                    <img :src="imagePreview" alt="角色预览" />
                </div>
                
                <div class="character-details">
                    <div class="detail-item">
                        <div class="detail-label">规范版本</div>
                        <div class="detail-value spec-version">{{ getSpecVersion() }}</div>
                    </div>

                    <div class="detail-item">
                        <div class="detail-label">角色名称</div>
                        <div class="detail-value">
                            <input type="text" v-model="editableData.name" class="character-name-input" placeholder="请输入角色名称" />
                        </div>
                    </div>
                    
                    <div class="detail-item" v-if="editableData.description">
                        <div class="detail-label">简介预览</div>
                        <div class="detail-value description-preview">
                            {{ editableData.description.substring(0, 120) }}{{ editableData.description.length > 120 ? '...' : '' }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="data-section">

                <div class="tabs">
                    <button v-for="tab in tabs" :key="tab.id" :class="['tab-button', { active: activeTab === tab.id }]"
                        @click="activeTab = tab.id">
                        {{ tab.name }}
                    </button>
                </div>

                <div class="tab-content">
                    <!-- 基本信息 -->
                    <BasicInfoTab 
                        v-if="activeTab === 'basic'"
                        :editableData="editableData"
                        @open-batch-translate="showBatchTranslateModal = true"
                        @open-global-replace="showGlobalReplaceModal = true"
                    />

                    <!-- 高级设置 -->
                    <AdvancedSettingsTab 
                        v-if="activeTab === 'advanced'"
                        :editableData="editableData"
                        @open-advanced-translate="showAdvancedBatchTranslateModal = true"
                        @add-alternate="addAlternateGreeting"
                        @remove-alternate="removeAlternateGreeting"
                    />

                    <!-- 世界书 -->
                    <WorldBookTab 
                        v-if="activeTab === 'book'"
                        :editableData="editableData"
                        :hasCharacterBook="hasCharacterBook()"
                        :isV3="isV3Card()"
                        @open-batch-translate="showBookBatchTranslateModal = true"
                        @add-entry="addBookEntry"
                        @remove-entry="removeBookEntry"
                        @create-book="createCharacterBook"
                        @update-keys="updateEntryKeys"
                    />

                    <!-- 原始JSON --> 
                    <!-- <div v-if="activeTab === 'json'" class="tab-pane">
                        <textarea v-model="jsonEditorContent" class="json-editor"></textarea>
                        <div class="json-actions">
                            <button @click="updateFromJson" class="action-button">应用JSON修改</button>
                            <p v-if="jsonError" class="error-text">{{ jsonError }}</p>
                        </div>
                    </div> -->
                </div>
            </div>

            <!-- 导出按钮区域 -->
            <div class="export-section">
                <div class="snapshot-actions">
                    <button @click="saveManualSnapshot" class="snapshot-button">保存快照</button>
                    <button @click="undoLastSnapshot" class="snapshot-button secondary" :disabled="!canUndoSnapshot">撤销</button>
                    <button @click="restoreInitialSnapshot" class="snapshot-button secondary" :disabled="!canRestoreInitialSnapshot">恢复初始</button>
                </div>
                <div v-if="snapshotMeta.currentLabel" class="snapshot-tip">当前快照：{{ snapshotMeta.currentLabel }}</div>
                <button @click="exportCharacterCard" class="export-button">导出角色卡</button>
                <div v-if="exportError" class="error-text">{{ exportError }}</div>
                <div v-if="exportSuccess" class="success-text">{{ exportSuccess }}</div>
            </div>
        </div>
        
        <SettingsModal :show="showSettingsModal" @close="showSettingsModal = false" @save="handleSaveSettings" />
        
        <!-- 翻译提示词模态框 -->
        <TranslationPromptModal :show="showPromptModal" @close="showPromptModal = false" />
        
        <!-- 破限文本模态框 -->
        <JailbreakTextModal :show="showJailbreakModal" @close="showJailbreakModal = false" />
        
        <!-- 翻译结果对比模态框 -->
        <TranslationCompareModal 
            :show="showCompareModal" 
            :compareData="translationCompareData"
            :type="translationCompareData[0]?.type || 'basic'"
            :modelName="finalTranslationInfo.modelName"
            :translationStartTime="finalTranslationInfo.startTime"
            :translationDuration="finalTranslationInfo.duration"
            @close="handleCompareClose"
            @apply="handleCompareApply"
            @preview="handleComparePreview"
        />
        
        <!-- 批量翻译模态框（组件化） -->
        <BatchTranslateModal
            :show="showBatchTranslateModal"
            :isTranslating="isTranslating"
            :isTranslationError="isTranslationError"
            :canRetryTranslation="canRetryTranslation"
            :isTranslationComplete="isTranslationComplete"
            :hasSelectedFields="hasSelectedFields"
            :selectedFields="selectedFields"
            :apiSettings="apiSettings"
            :formattedStartTime="formattedStartTime"
            :formattedCurrentTime="formattedCurrentTime"
            :translationDuration="translationDuration"
            :currentTranslatingField="currentTranslatingField"
            :translatedCount="translatedCount"
            :totalFieldsToTranslate="totalFieldsToTranslate"
            :progressPercentage="progressPercentage"
            :translationErrors="translationErrors"
            @close="closeBatchTranslateModal"
            @start="startBatchTranslation"
            @cancel="cancelTranslation"
            @retry="startBatchTranslation"
            @select-all="selectAllFields"
            @deselect-all="deselectAllFields"
            @show-error-details="showErrorDetails"
        />
        
        <!-- 世界书批量翻译模态框（组件化） -->
        <BookBatchTranslateModal
            ref="bookBatchTranslateModalRef"
            :show="showBookBatchTranslateModal"
            :isTranslating="isBookTranslating"
            :isError="isBookTranslationError"
            :canRetry="canRetryBookTranslation"
            :isComplete="isBookTranslationComplete"
            :hasSelections="hasBookSelections"
            :apiSettings="apiSettings"
            :formattedStartTime="formattedBookStartTime"
            :formattedCurrentTime="formattedCurrentTime"
            :translationDuration="bookTranslationDuration"
            :translatedCount="bookTranslatedCount"
            :totalToTranslate="bookTotalToTranslate"
            :progressPercentage="bookProgressPercentage"
            :translationErrors="bookTranslationErrors"
            :bookTranslateFields="bookTranslateFields"
            :entries="editableData?.book_entries || []"
            :selectedEntries="selectedBookEntries"
            :streamResults="bookStreamResults"
            :failedBatches="bookFailedBatchesData"
            @close="closeBookBatchTranslateModal"
            @start="startBookBatchTranslation"
            @cancel="cancelBookTranslation"
            @retry="startBookBatchTranslation"
            @retry-batch="retryBookBatch"
            @retry-all-failed="retryAllFailedBookBatches"
            @select-all-entries="selectAllBookEntries"
            @deselect-all-entries="deselectAllBookEntries"
            @show-error-details="showErrorDetails"
        />
        
        <!-- 高级设置批量翻译模态框（组件化） -->
        <AdvancedBatchTranslateModal
            :show="showAdvancedBatchTranslateModal"
            :isTranslating="isAdvancedTranslating"
            :isError="isAdvancedTranslationError"
            :canRetry="canRetryAdvancedTranslation"
            :isComplete="isAdvancedTranslationComplete"
            :hasSelectedFields="hasAdvancedSelectedFields"
            :apiSettings="apiSettings"
            :formattedStartTime="formattedAdvancedStartTime"
            :formattedCurrentTime="formattedCurrentTime"
            :translationDuration="advancedTranslationDuration"
            :translatedCount="advancedTranslatedCount"
            :totalToTranslate="advancedTotalToTranslate"
            :progressPercentage="advancedProgressPercentage"
            :translationErrors="advancedTranslationErrors"
            :advancedTranslateFields="advancedTranslateFields"
            :alternateGreetings="editableData?.alternate_greetings || []"
            :selectedAlternateGreetings="selectedAlternateGreetings"
            @close="closeAdvancedBatchTranslateModal"
            @start="startAdvancedBatchTranslation"
            @cancel="cancelAdvancedTranslation"
            @retry="startAdvancedBatchTranslation"
            @select-all-alt="selectAllAlternateGreetings"
            @deselect-all-alt="deselectAllAlternateGreetings"
            @show-error-details="showErrorDetails"
                            />
        
        <!-- 全局替换模态框（组件化） -->
        <GlobalReplaceModal
            :show="showGlobalReplaceModal"
            :replaceForm="replaceForm"
            :occurrenceCount="occurrenceCount"
            :occurrenceDetails="occurrenceDetails"
            @close="closeGlobalReplaceModal"
            @check="checkOccurrences"
            @execute="executeGlobalReplace"
        />

        <!-- 统一错误提示模态框（组件化） -->
        <ErrorModal :show="showErrorModal" :errorModal="errorModal" @close="closeErrorModal" />
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import BasicInfoTab from '@/components/tabs/BasicInfoTab.vue';
import AdvancedSettingsTab from '@/components/tabs/AdvancedSettingsTab.vue';
import WorldBookTab from '@/components/tabs/WorldBookTab.vue';
import { buildTranslationPrompt, getFriendlyErrorMessage, mapErrorCode } from '@/utils/translationHelpers';
import pako from 'pako';
import SettingsModal from '../components/SettingsModal.vue';
import TranslationPromptModal from '../components/TranslationPromptModal.vue';
import JailbreakTextModal from '../components/JailbreakTextModal.vue';
import TranslationCompareModal from '../components/TranslationCompareModal.vue';
import BatchTranslateModal from '@/components/modals/BatchTranslateModal.vue';
import BookBatchTranslateModal from '@/components/modals/BookBatchTranslateModal.vue';
import AdvancedBatchTranslateModal from '@/components/modals/AdvancedBatchTranslateModal.vue';
import GlobalReplaceModal from '@/components/modals/GlobalReplaceModal.vue';
import ErrorModal from '@/components/modals/ErrorModal.vue';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';
import CharacterCardParser, { CharacterCardUtils } from '@/utils/characterCardParser';
import {
    buildEditableCharacterData,
    createEmptyBookEntry,
    createEmptyCharacterBook,
    detectCharacterSpec,
    hasEditableCharacterBook,
    isV3Spec,
} from '@/utils/editorCardAdapter';
import { useStreamTranslation } from '@/composables/useStreamTranslation';
import { splitIntoBatches, buildBookTranslationTags, BatchState } from '@/utils/batchTranslationHelper';

const appStore = useAppStore();
const { apiSettings, translationConfig } = storeToRefs(appStore);

// API配置状态检查：用于显示状态，不再用于禁用按钮
const isApiReady = computed(() => {
    return !!(apiSettings.value.url && apiSettings.value.model);
});

// 检查API配置并显示友好提示
const checkAndPromptApiConfig = () => {
    if (!apiSettings.value.url || !apiSettings.value.model) {
        alert('请先在设置中配置API信息：\n\n1. 点击右上角"设置"按钮\n2. 填写API URL和选择模型\n3. 保存设置后即可使用翻译功能');
        return false;
    }
    return true;
};

const fileName = ref('');
const imagePreview = ref('');
const originalFileBytes = ref(null); // 保存原始文件字节数据用于导出
const characterData = ref(null);
const editableData = ref(null); // 可编辑的数据副本
const isLoading = ref(false);
const error = ref('');
const activeTab = ref('basic');
const debugMode = ref(true); // 开启调试模式
const showSettingsModal = ref(false);
const showPromptModal = ref(false);
const showJailbreakModal = ref(false);
const showCompareModal = ref(false);
const translationCompareData = ref([]);
const translationResults = ref(null); // 存储翻译结果

// 批量翻译相关变量
const showBatchTranslateModal = ref(false);
const selectedFields = reactive({
    name: true,
    description: true,
    personality: true,
    scenario: true,
    first_message: true,
    message_example: true
});
const isTranslating = ref(false);
const currentTranslatingField = ref('');
const translatedCount = ref(0);
const totalFieldsToTranslate = ref(0);
const translationErrors = ref([]);
const isTranslationComplete = ref(false);
const cancelTranslationFlag = ref(false);
const basicTranslationAbortController = ref(null);
// 添加新的状态变量

const isTranslationError = ref(false); // 翻译失败状态
const canRetryTranslation = ref(false); // 是否可以重试
const translationStartTime = ref(null); // 翻译开始时间
const currentTime = ref(new Date()); // 当前时间
let timeInterval = null; // 时间更新定时器

// 世界书批量翻译相关变量
const showBookBatchTranslateModal = ref(false);
const bookTranslateFields = reactive({
    name: true,
    keywords: true,
    content: true
});
const isBookTranslating = ref(false);
const bookTranslatedCount = ref(0);
const bookTotalToTranslate = ref(0);
const bookTranslationErrors = ref([]);
const isBookTranslationComplete = ref(false);
const cancelBookTranslationFlag = ref(false);
// 添加世界书翻译错误状态
const isBookTranslationError = ref(false); // 世界书翻译失败状态
const canRetryBookTranslation = ref(false); // 是否可以重试世界书翻译
const selectedBookEntries = ref([]);
const bookTranslationStartTime = ref(null); // 世界书翻译开始时间

// 世界书流式翻译和分批支持
const bookBatchTranslateModalRef = ref(null); // 模态框引用
const bookBatchState = new BatchState(); // 批次状态管理
const { 
    isStreaming: isBookStreaming,
    currentBatch: bookCurrentBatch,
    streamTranslate: bookStreamTranslate,
    cancelStream: cancelBookStream
} = useStreamTranslation();
const bookStreamResults = ref([]); // 流式翻译实时结果
const bookRequestAbortControllers = ref([]);
const bookTranslationMissingTags = ref([]);

// 高级设置批量翻译相关变量
const showAdvancedBatchTranslateModal = ref(false);
const advancedTranslateFields = reactive({
    system_prompt: true,
    post_history_instructions: true,
    creator_notes: true,
    alternate_greetings: true
});
const isAdvancedTranslating = ref(false);
const advancedTranslatedCount = ref(0);
const advancedTotalToTranslate = ref(0);
const advancedTranslationErrors = ref([]);
const isAdvancedTranslationComplete = ref(false);
const cancelAdvancedTranslationFlag = ref(false);
const advancedTranslationAbortController = ref(null);
const isAdvancedTranslationError = ref(false);
const canRetryAdvancedTranslation = ref(false);
const advancedTranslationStartTime = ref(null);
// 备选问候语分条目勾选
const selectedAlternateGreetings = ref([]);

// 打开/关闭高级翻译面板时初始化/重置勾选
watch(showAdvancedBatchTranslateModal, (val) => {
    if (val) {
        const count = Array.isArray(editableData.value?.alternate_greetings) ? editableData.value.alternate_greetings.length : 0;
        selectedAlternateGreetings.value = new Array(count).fill(false);
    } else {
        selectedAlternateGreetings.value = [];
    }
});

// 全局替换相关变量
const showGlobalReplaceModal = ref(false);
const replaceForm = reactive({
    originalText: '',
    newText: ''
});
const occurrenceCount = ref(0);
const occurrenceDetails = ref([]);

// 保存最终翻译信息用于对比弹窗
const finalTranslationInfo = ref({
    startTime: '',
    duration: '',
    modelName: ''
});

// 统一错误提示模态框状态
const showErrorModal = ref(false);
const errorModal = reactive({
    title: '提示',
    code: '',
    message: '',
    status: null,
    statusText: '',
    details: null,
    suggestions: []
});

const openErrorModal = (payload = {}) => {
    errorModal.title = payload.title || '提示';
    errorModal.code = payload.code || '';
    errorModal.message = payload.message || '';
    errorModal.status = payload.status ?? null;
    errorModal.statusText = payload.statusText || '';
    errorModal.details = payload.details ?? null;
    errorModal.suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    showErrorModal.value = true;
};

const closeErrorModal = () => {
    showErrorModal.value = false;
};

// 计算属性
const hasSelectedFields = computed(() => {
    return Object.values(selectedFields).some(selected => selected);
});

const progressPercentage = computed(() => {
    if (totalFieldsToTranslate.value === 0) return 0;
    return Math.round((translatedCount.value / totalFieldsToTranslate.value) * 100);
});

const bookProgressPercentage = computed(() => {
    if (bookTotalToTranslate.value === 0) return 0;
    return Math.round((bookTranslatedCount.value / bookTotalToTranslate.value) * 100);
});

// 失败批次数据（用于UI显示）
const bookFailedBatchesData = computed(() => {
    return bookBatchState.batches
        .filter(batch => batch.status === 'error')
        .map(batch => ({
            index: batch.index,
            error: batch.error || '未知错误'
        }));
});

const hasBookSelections = computed(() => {
    const hasFields = Object.values(bookTranslateFields).some(selected => selected);
    const hasEntries = selectedBookEntries.value.some(selected => selected);
    return hasFields && hasEntries;
});

// 时间格式化计算属性
const formattedCurrentTime = computed(() => {
    return currentTime.value.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

const formattedStartTime = computed(() => {
    if (!translationStartTime.value) return '';
    return translationStartTime.value.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

const formattedBookStartTime = computed(() => {
    if (!bookTranslationStartTime.value) return '';
    return bookTranslationStartTime.value.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

const formattedAdvancedStartTime = computed(() => {
    if (!advancedTranslationStartTime.value) return '';
    return advancedTranslationStartTime.value.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

const translationDuration = computed(() => {
    if (!translationStartTime.value) return '';
    const duration = Math.floor((currentTime.value - translationStartTime.value) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const bookTranslationDuration = computed(() => {
    if (!bookTranslationStartTime.value) return '';
    const duration = Math.floor((currentTime.value - bookTranslationStartTime.value) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const advancedTranslationDuration = computed(() => {
    if (!advancedTranslationStartTime.value) return '';
    const duration = Math.floor((currentTime.value - advancedTranslationStartTime.value) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const hasAdvancedSelectedFields = computed(() => {
    // 非问候语字段只要勾选任意一个即可
    const anyNonGreeting = advancedTranslateFields.system_prompt || advancedTranslateFields.post_history_instructions || advancedTranslateFields.creator_notes;
    if (anyNonGreeting) return true;
    // 问候语字段需至少勾选一条具体问候
    if (advancedTranslateFields.alternate_greetings) {
        return selectedAlternateGreetings.value.some(Boolean);
    }
    return false;
});

const advancedProgressPercentage = computed(() => {
    if (advancedTotalToTranslate.value === 0) return 0;
    return Math.round((advancedTranslatedCount.value / advancedTotalToTranslate.value) * 100);
});

const tabs = [
    { id: 'basic', name: '基本信息' },
    { id: 'advanced', name: '高级设置' },
    { id: 'book', name: '世界书' },
    // { id: 'json', name: '原始JSON' }
];

// 处理文件上传
const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    fileName.value = file.name;
    error.value = '';
    console.log('开始处理新文件，清空原有数据');
    characterData.value = null;
    editableData.value = null;
    originalFileBytes.value = null;
    isLoading.value = true;

    try {
        const isJsonFile = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');

        if (isJsonFile) {
            imagePreview.value = '';
            const rawText = await file.text();
            const parseResult = CharacterCardUtils.parseJson(rawText);

            if (!parseResult.success) {
                throw new Error('解析 JSON 角色卡失败');
            }

            characterData.value = parseResult.data;
            initEditableData();
            return;
        }

        imagePreview.value = URL.createObjectURL(file);
        const arrayBuffer = await file.arrayBuffer();
        originalFileBytes.value = new Uint8Array(arrayBuffer);

        const parseResult = await CharacterCardUtils.parseFile(file);

        if (parseResult.success) {
            characterData.value = parseResult.data;
            console.log('成功解析角色卡数据:', parseResult);
            console.log('角色卡版本:', parseResult.metadata.version);
            console.log('是否包含世界书:', parseResult.metadata.hasWorldBook);
            initEditableData();
        } else {
            throw new Error('解析角色卡失败');
        }
    } catch (err) {
        console.error('解析错误:', err);
        error.value = `解析失败: ${err.message}`;
    } finally {
        isLoading.value = false;
        event.target.value = '';
    }
};

const jsonEditorContent = ref('');
const jsonError = ref('');
const exportError = ref('');
const exportSuccess = ref('');
const snapshots = ref([]);
const snapshotCursor = ref(-1);
const snapshotMeta = reactive({
    currentLabel: '',
    initialLabel: ''
});
const MAX_SNAPSHOTS = 20;

const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

const canUndoSnapshot = computed(() => snapshotCursor.value > 0 && snapshots.value.length > 0);
const canRestoreInitialSnapshot = computed(() => snapshots.value.length > 0 && snapshotCursor.value !== 0);

const applySnapshotState = (snapshot) => {
    editableData.value = reactive(cloneDeep(snapshot.data));
    snapshotMeta.currentLabel = snapshot.label;
    jsonEditorContent.value = JSON.stringify(editableData.value, null, 2);
};

const pushSnapshot = (label = '手动快照') => {
    if (!editableData.value) return;

    const nextSnapshots = snapshots.value.slice(0, snapshotCursor.value + 1);
    nextSnapshots.push({
        label,
        createdAt: Date.now(),
        data: cloneDeep(editableData.value)
    });

    if (nextSnapshots.length > MAX_SNAPSHOTS) {
        nextSnapshots.shift();
    }

    snapshots.value = nextSnapshots;
    snapshotCursor.value = snapshots.value.length - 1;
    snapshotMeta.currentLabel = label;
    if (!snapshotMeta.initialLabel) {
        snapshotMeta.initialLabel = label;
    }
};

const saveManualSnapshot = () => {
    pushSnapshot(`手动快照 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
    exportSuccess.value = '快照已保存';
};

const undoLastSnapshot = () => {
    if (!canUndoSnapshot.value) return;
    snapshotCursor.value -= 1;
    applySnapshotState(snapshots.value[snapshotCursor.value]);
};

const restoreInitialSnapshot = () => {
    if (!snapshots.value.length) return;
    snapshotCursor.value = 0;
    applySnapshotState(snapshots.value[0]);
};

// 初始化可编辑数据
const initEditableData = () => {
    if (!characterData.value) return;

    console.log('初始化可编辑数据开始...');
    console.log('角色卡原始数据:', characterData.value);

    const normalizedEditableData = buildEditableCharacterData(characterData.value);
    editableData.value = reactive(normalizedEditableData);

    snapshots.value = [];
    snapshotCursor.value = -1;
    snapshotMeta.currentLabel = '';
    snapshotMeta.initialLabel = '';
    pushSnapshot('初始导入');
    jsonEditorContent.value = JSON.stringify(editableData.value, null, 2);

    console.log('初始化了', editableData.value.book_entries.length, '个世界书条目');
    console.log('最终可编辑数据:', editableData.value);
};

// 创建世界书
const createCharacterBook = () => {
    pushSnapshot('创建世界书');
    if (!editableData.value.character_book) {
        editableData.value.character_book = createEmptyCharacterBook({ name: '新建世界书' });
    }

    if (!Array.isArray(editableData.value.book_entries)) {
        editableData.value.book_entries = [];
    }
};

const updateFromJson = () => {
    try {
        pushSnapshot('应用 JSON 前');
        const parseResult = CharacterCardUtils.parseJson(jsonEditorContent.value);
        characterData.value = parseResult.data;
        console.log('成功应用JSON修改:', parseResult.data);
        jsonError.value = '';
        initEditableData();
    } catch (err) {
        console.error('应用JSON修改失败:', err);
        jsonError.value = `应用失败: ${err.message}`;
    }
};

const addAlternateGreeting = () => {
    pushSnapshot('新增备选问候语');
    if (!editableData.value.alternate_greetings) {
        editableData.value.alternate_greetings = [];
    }
    editableData.value.alternate_greetings = [...editableData.value.alternate_greetings, ''];
};

const removeAlternateGreeting = (index) => {
    pushSnapshot('删除备选问候语');
    editableData.value.alternate_greetings = editableData.value.alternate_greetings.filter((_, i) => i !== index);
};

const addBookEntry = () => {
    pushSnapshot('新增世界书条目');
    const newIndex = editableData.value.book_entries ? editableData.value.book_entries.length : 0;
    editableData.value.book_entries = [...(editableData.value.book_entries || []), createEmptyBookEntry(newIndex)];
};

const removeBookEntry = (index) => {
    pushSnapshot('删除世界书条目');
    editableData.value.book_entries = editableData.value.book_entries.filter((_, i) => i !== index);
};

const updateEntryKeys = (entry) => {
    if (!entry.keysText) {
        entry.keys = [];
        return;
    }
    
    // 将关键词文本分割为数组并去除前后空格
    const keyArray = entry.keysText.split(',');
    entry.keys = keyArray.map(k => k.trim()).filter(Boolean);
    
    console.log('更新后的关键词:', entry.keys);
};

const isV3Card = () => {
    return isV3Spec(detectCharacterSpec(characterData.value));
};

// 检查是否有世界书
const hasCharacterBook = () => {
    return hasEditableCharacterBook(editableData.value);
};

// 获取角色卡规格版本
const getSpecVersion = () => {
    return characterData.value ? detectCharacterSpec(characterData.value) : '未知';
};

// 导出角色卡
const exportCharacterCard = async () => {
    if (!characterData.value || !editableData.value) {
        alert('没有角色卡数据可以导出！');
        return;
    }

    try {
        exportError.value = '';
        exportSuccess.value = '';

        console.log('开始导出，当前数据状态：');
        console.log('characterData.value:', characterData.value);
        console.log('editableData.value:', editableData.value);
        console.log('世界书条目数量:', editableData.value.book_entries?.length || 0);

        // 准备要导出的数据
        const finalCharacterData = JSON.parse(JSON.stringify(characterData.value));
        
        // 更新data部分
        if (finalCharacterData.data) {
            finalCharacterData.data = editableData.value;
        } else {
            // 如果没有data字段，需要包装
            finalCharacterData.data = editableData.value;
            finalCharacterData.spec = finalCharacterData.spec || getSpecVersion();
        }

        // 使用新的封装模块导出
        const newPngBytes = CharacterCardUtils.exportToPNG(finalCharacterData, originalFileBytes.value);
        
        // 生成文件名
        const characterName = editableData.value.name || 'character';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const filename = `${characterName}_${timestamp}.png`;
        
        // 下载文件
        CharacterCardUtils.downloadPNG(newPngBytes, filename);
        
        exportSuccess.value = '角色卡导出成功！';
        console.log('角色卡导出成功');
        
        // 导出成功后，验证数据是否仍然存在
        console.log('导出完成后，数据状态：');
        console.log('characterData.value存在:', !!characterData.value);
        console.log('editableData.value存在:', !!editableData.value);
        console.log('世界书条目数量:', editableData.value?.book_entries?.length || 0);
        
    } catch (err) {
        console.error('导出失败:', err);
        console.error('导出失败时的数据状态：');
        console.log('characterData.value存在:', !!characterData.value);
        console.log('editableData.value存在:', !!editableData.value);
        exportError.value = `导出失败: ${err.message}`;
    }
};

const handleSaveSettings = (settings) => {
    // This event is kept for now, but settings are managed by Pinia
    console.log('API settings saved via modal event:', settings);
};

// 显示错误详情
const showErrorDetails = (errorDetails) => {
    let message = '详细错误信息:\n\n';
    
    if (errorDetails.code) {
        message += `错误代码: ${errorDetails.code}\n`;
    }
    
    if (errorDetails.type) {
        message += `错误类型: ${errorDetails.type}\n`;
    }
    
    if (errorDetails.message) {
        message += `错误信息: ${errorDetails.message}\n`;
    }
    
    if (errorDetails.status) {
        message += `HTTP状态: ${errorDetails.status}\n`;
    }
    
    if (errorDetails.statusText) {
        message += `状态文本: ${errorDetails.statusText}\n`;
    }
    
    // 显示其他可能的错误属性
    const excludeKeys = ['code', 'type', 'message', 'status', 'statusText'];
    Object.keys(errorDetails).forEach(key => {
        if (!excludeKeys.includes(key) && errorDetails[key] !== null && errorDetails[key] !== undefined) {
            message += `${key}: ${JSON.stringify(errorDetails[key])}\n`;
        }
    });
    
    alert(message);
};

// 时间管理函数
const startTimeTracking = () => {
    translationStartTime.value = new Date();
    currentTime.value = new Date();
    
    // 每秒更新当前时间
    timeInterval = setInterval(() => {
        currentTime.value = new Date();
    }, 1000);
};

const startBookTimeTracking = () => {
    bookTranslationStartTime.value = new Date();
    currentTime.value = new Date();
    
    // 如果还没有时间更新器，创建一个
    if (!timeInterval) {
        timeInterval = setInterval(() => {
            currentTime.value = new Date();
        }, 1000);
    }
};

const startAdvancedTimeTracking = () => {
    advancedTranslationStartTime.value = new Date();
    currentTime.value = new Date();
    
    // 如果还没有时间更新器，创建一个
    if (!timeInterval) {
        timeInterval = setInterval(() => {
            currentTime.value = new Date();
        }, 1000);
    }
};

const stopTimeTracking = () => {
    if (timeInterval) {
        clearInterval(timeInterval);
        timeInterval = null;
    }
    translationStartTime.value = null;
    bookTranslationStartTime.value = null;
    advancedTranslationStartTime.value = null;
};

// 使用拆分后的通用辅助函数

// 初始化配置
onMounted(() => {
    // 加载API设置和翻译配置
    appStore.loadApiSettings();
    appStore.loadTranslationConfig();
});



const selectAllFields = () => {
    selectedFields.name = true;
    selectedFields.description = true;
    selectedFields.personality = true;
    selectedFields.scenario = true;
    selectedFields.first_message = true;
    selectedFields.message_example = true;
};

const deselectAllFields = () => {
    selectedFields.name = false;
    selectedFields.description = false;
    selectedFields.personality = false;
    selectedFields.scenario = false;
    selectedFields.first_message = false;
    selectedFields.message_example = false;
};

const fieldNameMap = {
    name: '角色名称',
    description: '描述',
    personality: '性格',
    scenario: '场景',
    first_message: '首次问候',
    message_example: '示例对话'
};

const startBatchTranslation = async () => {
    // 首先检查API配置
    if (!checkAndPromptApiConfig()) {
        return;
    }
    
    isTranslating.value = true;
    currentTranslatingField.value = '准备翻译...';
    translatedCount.value = 0;
    totalFieldsToTranslate.value = 0;
    translationErrors.value = [];
    isTranslationComplete.value = false;
    isTranslationError.value = false;
    canRetryTranslation.value = false;
    cancelTranslationFlag.value = false;
    
    // 启动时间跟踪
    startTimeTracking();

    // 准备需要翻译的字段
    const fieldsToTranslate = [];
    let totalItemsToTranslate = 0;
    
    // 检查普通字段
    Object.keys(selectedFields).forEach(field => {
        if (selectedFields[field] && editableData.value[field] && editableData.value[field].trim()) {
            // 处理普通字段
            fieldsToTranslate.push({
                type: 'normal',
                field: field,
                content: editableData.value[field].trim()
            });
            totalItemsToTranslate++;
        }
    });
    
    if (fieldsToTranslate.length === 0) {
        alert('没有可翻译的内容！请确保选中的字段有文本内容。');
        isTranslating.value = false;
        return;
    }
    
    totalFieldsToTranslate.value = totalItemsToTranslate;

    try {
        // 构建带标签的文本
        let taggedText = '';
        const fieldMap = {};
        
        fieldsToTranslate.forEach((item, index) => {
            const tag = `TXT${index + 1}`;
            taggedText += `<${tag}>${item.content}</${tag}>\n\n`;
            fieldMap[tag] = item;
        });

        currentTranslatingField.value = '正在翻译所有字段...';
        
        // 单次API请求翻译所有内容
        basicTranslationAbortController.value = new AbortController();
        const response = await fetch(apiSettings.value.url + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.value.key}`
            },
            signal: basicTranslationAbortController.value.signal,
            body: JSON.stringify({
                model: apiSettings.value.model,
                messages: [
                    { 
                        role: 'system', 
                        content: buildTranslationPrompt(translationConfig.value, true)
                    },
                    { role: 'user', content: taggedText }
                ],
                temperature: 0.3  // 降低温度以提高准确性
            })
        });
        basicTranslationAbortController.value = null;

        if (!response.ok) {
            const errData = await response.json();
            // 保存完整的错误信息
            const errorInfo = {
                status: response.status,
                statusText: response.statusText,
                ...errData.error
            };
            const errorMessage = JSON.stringify(errorInfo, null, 2);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error('API未返回任何结果');
        }

        const translatedText = data.choices[0].message.content;
        console.log('API返回的翻译结果:', translatedText);

        // 解析翻译结果
        const translationResults = {};
        const missingTags = [];
        const expectedTags = Object.keys(fieldMap);
        
        for (const [tag, item] of Object.entries(fieldMap)) {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = translatedText.match(regex);
            
            if (match && match[1]) {
                // 处理普通字段（基本信息批量翻译中不再处理备选问候语）
                translationResults[item.field] = match[1].trim();
                translatedCount.value++;
            } else {
                const fieldDisplayName = fieldNameMap[item.field] || item.field;
                missingTags.push({
                    field: fieldDisplayName,
                    tag: tag
                });
            }
        }

        // 若所有标签均未解析成功，视为返回格式不符合预期
        if (Object.keys(translationResults).length === 0 || missingTags.length === expectedTags.length) {
            const badFormatMsg = '返回结果未遵循预期返回格式，请重试';
            openErrorModal({
                title: '翻译失败',
                code: 'BAD_FORMAT',
                message: badFormatMsg,
                details: { expectedTags, translatedText: translatedText?.slice(0, 800) }
            });
            translationErrors.value.push({ field: '批量翻译', message: badFormatMsg });
            isTranslationError.value = true;
            canRetryTranslation.value = true;
            isTranslating.value = false;
            stopTimeTracking();
            return;
        }

        // 显示结果确认对话框
        if (Object.keys(translationResults).length > 0) {
            // 准备对比数据并显示对比界面
            prepareTranslationCompare(translationResults, missingTags, 'basic');
        } else {
            const badFormatMsg = '返回结果未遵循预期返回格式，请重试';
            openErrorModal({
                title: '翻译失败',
                code: 'BAD_FORMAT',
                message: badFormatMsg,
            });
            translationErrors.value.push({ field: '批量翻译', message: badFormatMsg });
            isTranslationError.value = true;
            canRetryTranslation.value = true;
            isTranslating.value = false;
            stopTimeTracking();
            return;
        }

        // 记录丢失的标签作为错误
        if (missingTags.length > 0) {
            missingTags.forEach(({ field, tag }) => {
                translationErrors.value.push({
                    field: field,
                    message: `标签 ${tag} 在返回结果中丢失`
                });
            });
        }

    } catch (err) {
        if (err?.name === 'AbortError') {
            console.log('批量翻译已取消');
            return;
        }
        console.error('批量翻译失败:', err);
        
        // 解析错误信息
        let errorMessage = err.message;
        let errorDetails = null;
        
        try {
            // 尝试解析服务器返回的错误格式
            if (err.message.includes('{')) {
                const errorObj = JSON.parse(err.message);
                if (errorObj.error) {
                    errorDetails = errorObj.error;
                    errorMessage = errorObj.error.message || err.message;
                } else if (errorObj.code || errorObj.type) {
                    errorDetails = errorObj;
                    errorMessage = errorObj.message || err.message;
                }
            }
        } catch (parseErr) {
            // 如果不是JSON格式，使用原始错误信息
            console.log('非JSON格式错误，使用原始信息');
        }
        
        // 合并HTTP状态信息
        if (!errorDetails && err && typeof err === 'object') {
            try {
                const parsed = JSON.parse(err.message);
                if (parsed && (parsed.status || parsed.statusText)) {
                    errorDetails = { ...parsed, ...(parsed.error || {}) };
                }
            } catch (_) {}
        }

        // 显示用户友好的错误信息弹窗
        const friendlyMessage = getFriendlyErrorMessage(errorDetails || { message: errorMessage });
        openErrorModal({
            title: '翻译失败',
            code: mapErrorCode(errorDetails || { message: errorMessage }),
            message: friendlyMessage,
            status: errorDetails?.status,
            statusText: errorDetails?.statusText,
            details: errorDetails || { message: errorMessage }
        });
        
        translationErrors.value.push({
            field: '批量翻译',
            message: errorMessage,
            details: errorDetails
        });
        
        // 设置错误状态，允许重试
        isTranslationError.value = true;
        canRetryTranslation.value = true;
        isTranslating.value = false;
        
        // 停止时间跟踪
        stopTimeTracking();
        
        // 不设置完成状态，因为这是错误情况
        return;
    }

    // 只有在成功的情况下才设置完成状态
    isTranslating.value = false;
    isTranslationComplete.value = true;
    
    // 停止时间跟踪
    stopTimeTracking();
};

// 新增：显示翻译确认对话框
const showTranslationConfirmDialog = (results, missingTags) => {
    return new Promise((resolve) => {
        // 创建确认对话框内容
        let message = '翻译完成！\n\n成功翻译的字段：\n';
        
        for (const [field, translation] of Object.entries(results)) {
            const fieldName = fieldNameMap[field] || field;
            message += `✅ ${fieldName}\n`;
        }
        
        if (missingTags.length > 0) {
            message += '\n以下字段翻译失败：\n';
            missingTags.forEach(({ field }) => {
                message += `❌ ${field}\n`;
            });
        }
        
        message += '\n是否应用成功的翻译结果？';
        
        // 使用确认对话框（后续可以替换为更美观的模态框）
        const confirmed = confirm(message);
        resolve(confirmed);
    });
};

const cancelTranslation = () => {
    cancelTranslationFlag.value = true;
    basicTranslationAbortController.value?.abort();
    basicTranslationAbortController.value = null;
    isTranslating.value = false;
    isTranslationComplete.value = false;
};

const closeBatchTranslateModal = () => {
    showBatchTranslateModal.value = false;
    // 重置状态
    isTranslating.value = false;
    isTranslationComplete.value = false;
    isTranslationError.value = false;
    canRetryTranslation.value = false;
    translationErrors.value = [];
    cancelTranslationFlag.value = false;
    
    // 确保停止时间跟踪
    stopTimeTracking();
};

// 世界书批量翻译函数
const selectAllBookEntries = () => {
    if (editableData.value.book_entries) {
        selectedBookEntries.value = new Array(editableData.value.book_entries.length).fill(true);
    }
};

const deselectAllBookEntries = () => {
    selectedBookEntries.value = [];
};

// 备选问候语全选/取消
const selectAllAlternateGreetings = () => {
    const count = Array.isArray(editableData.value?.alternate_greetings) ? editableData.value.alternate_greetings.length : 0;
    selectedAlternateGreetings.value = new Array(count).fill(true);
};

const deselectAllAlternateGreetings = () => {
    const count = Array.isArray(editableData.value?.alternate_greetings) ? editableData.value.alternate_greetings.length : 0;
    selectedAlternateGreetings.value = new Array(count).fill(false);
};

const startBookBatchTranslation = async () => {
    // 首先检查API配置
    if (!checkAndPromptApiConfig()) {
        return;
    }
    
    // 获取模态框中的批次设置
    const modalSettings = bookBatchTranslateModalRef.value;
    const useStream = modalSettings?.useStreamTranslation ?? false;
    const useConcurrent = modalSettings?.useConcurrentTranslation ?? false;
    const batchCount = modalSettings?.batchCount ?? 1;
    
    console.log('📊 批量翻译设置:');
    console.log('  - useStream:', useStream);
    console.log('  - useConcurrent:', useConcurrent);
    console.log('  - batchCount:', batchCount);
    
    isBookTranslating.value = true;
    bookTranslatedCount.value = 0;
    bookTotalToTranslate.value = 0;
    bookTranslationErrors.value = [];
    bookTranslationMissingTags.value = [];
    isBookTranslationComplete.value = false;
    isBookTranslationError.value = false;
    canRetryBookTranslation.value = false;
    cancelBookTranslationFlag.value = false;
    bookStreamResults.value = [];
    
    // 启动世界书时间跟踪
    startBookTimeTracking();

    // 获取选中的条目索引
    const selectedIndices = selectedBookEntries.value
        .map((selected, index) => selected ? index : -1)
        .filter(index => index !== -1);
    
    if (selectedIndices.length === 0) {
        alert('请至少选择一个条目进行翻译！');
        isBookTranslating.value = false;
        return;
    }

    // 获取选中的字段
    const fieldsToTranslate = [];
    if (bookTranslateFields.name) fieldsToTranslate.push('name');
    if (bookTranslateFields.keywords) fieldsToTranslate.push('keywords');
    if (bookTranslateFields.content) fieldsToTranslate.push('content');
    
    if (fieldsToTranslate.length === 0) {
        alert('请至少选择一个字段进行翻译！');
        isBookTranslating.value = false;
        return;
    }

    try {
        // 第一步：将选中的条目按批次拆分
        const batches = splitIntoBatches(selectedIndices, batchCount);
        const totalBatches = batches.length;
        
        console.log(`📦 拆分为 ${totalBatches} 个批次:`, batches.map(b => b.length));
        
        // 初始化批次状态（保存批次数据用于重试）
        bookBatchState.init(totalBatches, batches);
        
        // 计算总条目数（用于显示总进度）
        let totalItemsToTranslate = 0;
        batches.forEach(batchIndices => {
            batchIndices.forEach(entryIndex => {
            fieldsToTranslate.forEach(field => {
                    const entry = editableData.value.book_entries[entryIndex];
                    if ((field === 'name' && entry.name) ||
                        (field === 'keywords' && entry.keysText) ||
                        (field === 'content' && entry.content)) {
                        totalItemsToTranslate++;
                    }
                });
            });
        });
        
        bookTotalToTranslate.value = totalItemsToTranslate;
        console.log(`📊 总共需要翻译 ${totalItemsToTranslate} 个字段`);
        console.log(`🚀 翻译模式: ${useConcurrent && batches.length > 1 ? '并发' : '串行'}`);
        
        // 定义单个批次的翻译函数
        const translateBatch = async (batchIndex) => {
            if (cancelBookTranslationFlag.value) {
                console.log('翻译被取消');
                return { cancelled: true };
            }
            
            const batchIndices = batches[batchIndex];
            console.log(`\n🔄 开始翻译第 ${batchIndex + 1}/${totalBatches} 批，包含 ${batchIndices.length} 个条目`);
            
            // 标记当前批次为翻译中
            bookBatchState.setBatchStatus(batchIndex, 'translating');
            
            // 为当前批次构建标签文本
            const { taggedText, fieldMap, totalTags } = buildBookTranslationTags(
                editableData.value.book_entries,
                batchIndices,
                fieldsToTranslate,
                editableData.value
            );

            if (!taggedText || totalTags === 0) {
                console.warn(`批次 ${batchIndex + 1} 没有可翻译内容，跳过`);
                bookBatchState.setBatchStatus(batchIndex, 'success', { results: {} });
                return { success: true, skipped: true };
            }
            
            console.log(`批次 ${batchIndex + 1} 包含 ${totalTags} 个待翻译字段`);
        
            // 判断使用流式还是普通翻译
            try {
                if (useStream) {
                    console.log(`批次 ${batchIndex + 1} 使用流式翻译模式`);
                    
                    // 流式翻译 - 支持实时预览
                    const result = await bookStreamTranslate({
                        apiUrl: apiSettings.value.url,
                        apiKey: apiSettings.value.key,
                        model: apiSettings.value.model,
                        systemPrompt: buildTranslationPrompt(translationConfig.value, true) + '\nFor keyword lists separated by commas, translate each keyword and keep the comma separation.',
                        userContent: taggedText,
                        tagMap: fieldMap,
                        onProgress: (progressData) => {
                            // 实时更新进度
                            console.log('流式进度更新:', progressData);
                            if (progressData.completed) {
                                bookTranslatedCount.value++;
                                
                                // 将完成的结果添加到流式结果列表（用于实时预览）
                                bookStreamResults.value.push({
                                    tag: progressData.tag,
                                    result: progressData.result,
                                    info: progressData.info,
                                    batchIndex: batchIndex,
                                    selected: true // 默认选中
                                });
                            }
                        }
        });

                    if (cancelBookTranslationFlag.value) {
                        console.log('翻译被取消');
                        bookBatchState.setBatchStatus(batchIndex, 'error', { error: '用户取消' });
                        return { cancelled: true };
                    }
                    
                    if (!result.success) {
                        throw new Error(result.error || '流式翻译失败');
                    }
                    
                    // 解析流式翻译结果
                    const batchResults = {};
                    const missingTags = [];
                    const expectedTags = Object.keys(fieldMap);
                    
                    for (const [tag, content] of Object.entries(result.results)) {
                        const info = fieldMap[tag];
                        if (info) {
                            if (!batchResults[info.entryIndex]) {
                                batchResults[info.entryIndex] = {};
                            }
                            batchResults[info.entryIndex][info.field] = content;
                        }
                    }
                    
                    // 检查缺失的标签
                    for (const tag of expectedTags) {
                        if (!result.results[tag]) {
                            const info = fieldMap[tag];
                            const fieldName = info.field === 'name' ? '名称' : 
                                            info.field === 'keywords' ? '关键词' : '内容';
                            missingTags.push({
                                field: `${info.entryName} - ${fieldName}`,
                                tag: tag
                            });
                        }
                    }
                    
                    // 标记批次成功
                    bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
                    console.log(`✅ 批次 ${batchIndex + 1} 翻译完成，成功 ${Object.keys(batchResults).length} 个条目`);
                    
                    // 记录缺失标签
                    if (missingTags.length > 0) {
                        missingTags.forEach(({ field, tag }) => {
                            const missingItem = {
                                field: `批次${batchIndex + 1} - ${field}`,
                                tag,
                            };
                            bookTranslationMissingTags.value.push(missingItem);
                            bookTranslationErrors.value.push({
                                field: missingItem.field,
                                message: `标签 ${tag} 在返回结果中丢失`
                            });
                        });
                    }
                    
                } else {
                    console.log(`批次 ${batchIndex + 1} 使用普通翻译模式`);
        
                    // 普通翻译（非流式）
        const batchAbortController = new AbortController();
        bookRequestAbortControllers.value.push(batchAbortController);
        const response = await fetch(apiSettings.value.url + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.value.key}`
            },
            signal: batchAbortController.signal,
            body: JSON.stringify({
                model: apiSettings.value.model,
                messages: [
                    { 
                        role: 'system', 
                                    content: buildTranslationPrompt(translationConfig.value, true) + '\nFor keyword lists separated by commas, translate each keyword and keep the comma separation.'
                    },
                    { role: 'user', content: taggedText }
                ],
                temperature: 0.3
            })
        });

        bookRequestAbortControllers.value = bookRequestAbortControllers.value.filter(controller => controller !== batchAbortController);

        if (!response.ok) {
            const errData = await response.json();
            const errorInfo = {
                status: response.status,
                statusText: response.statusText,
                ...errData.error
            };
                        throw new Error(JSON.stringify(errorInfo, null, 2));
        }

        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error('API未返回任何结果');
        }

        const translatedText = data.choices[0].message.content;
                    console.log(`批次 ${batchIndex + 1} API返回结果:`, translatedText.substring(0, 200));

                    // 解析当前批次的翻译结果
                    const batchResults = {};
        const missingTags = [];
        const expectedTags = Object.keys(fieldMap);
        
        for (const [tag, info] of Object.entries(fieldMap)) {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = translatedText.match(regex);
            
            if (match && match[1]) {
                            if (!batchResults[info.entryIndex]) {
                                batchResults[info.entryIndex] = {};
                }
                            batchResults[info.entryIndex][info.field] = match[1].trim();
                bookTranslatedCount.value++;
                            console.log(`✓ 条目${info.entryIndex} ${info.field}`);
        } else {
                const entryName = editableData.value.book_entries[info.entryIndex].name || `条目 ${info.entryIndex + 1}`;
                const fieldName = info.field === 'name' ? '名称' : 
                                info.field === 'keywords' ? '关键词' : '内容';
                missingTags.push({
                    field: `${entryName} - ${fieldName}`,
                    tag: tag
                });
            }
        }

                    console.log('普通翻译 - 世界书翻译结果:', batchResults);
                    console.log('普通翻译 - 丢失的标签:', missingTags);
        
                    // 若当前批次返回不符合预期格式
                    if (Object.keys(batchResults).length === 0 || missingTags.length === expectedTags.length) {
                        const badFormatMsg = `批次 ${batchIndex + 1} 返回结果未遵循预期返回格式`;
                        bookBatchState.setBatchStatus(batchIndex, 'error', { error: badFormatMsg });
                        bookTranslationErrors.value.push({ 
                            field: `批次 ${batchIndex + 1}`, 
                            message: badFormatMsg 
                        });
                        console.error(`❌ 批次 ${batchIndex + 1} 翻译失败`);
                        return { error: badFormatMsg };
                    }
                    
                    // 标记当前批次成功
                    bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
                    console.log(`✅ 批次 ${batchIndex + 1} 翻译完成，成功 ${Object.keys(batchResults).length} 个条目`);

                    // 记录丢失的标签作为错误
                    if (missingTags.length > 0) {
                        missingTags.forEach(({ field, tag }) => {
                            const missingItem = {
                                field: `批次${batchIndex + 1} - ${field}`,
                                tag,
                            };
                            bookTranslationMissingTags.value.push(missingItem);
                            bookTranslationErrors.value.push({
                                field: missingItem.field,
                                message: `标签 ${tag} 在返回结果中丢失`
                            });
                        });
                    }
                } // 结束 else 块（普通翻译模式）
                
            } catch (batchError) {
                // 单个批次翻译失败
                console.error(`❌ 批次 ${batchIndex + 1} 翻译失败:`, batchError);
                bookBatchState.setBatchStatus(batchIndex, 'error', { error: batchError.message });
                bookTranslationErrors.value.push({
                    field: `批次 ${batchIndex + 1}`,
                    message: batchError.message
                });
                return { error: batchError.message };
            }
            
            return { success: true };
        }; // 结束 translateBatch 函数定义
        
        // 第二步：根据并发设置执行批次翻译
        if (useConcurrent && batches.length > 1) {
            console.log('🚀 使用并发模式翻译多个批次');
            
            // 并发执行所有批次
            const batchPromises = batches.map((_, index) => translateBatch(index));
            await Promise.allSettled(batchPromises);
            
        } else {
            console.log('🔄 使用串行模式逐批翻译');
            
            // 串行执行批次
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const result = await translateBatch(batchIndex);
                
                if (result?.cancelled) {
                    console.log('翻译被取消，停止所有批次');
                    break;
                }
            }
        }
        
        // 第三步：所有批次完成后，汇总结果并显示对比界面
        console.log('\n📊 所有批次翻译完成，开始汇总结果');
        console.log('批次状态:', bookBatchState.batches);
        
        // 统计批次结果
        const successCount = bookBatchState.getSuccessCount();
        const failedBatches = bookBatchState.getFailedBatches();
        const allMissingTags = [...bookTranslationMissingTags.value];
        
        console.log(`✅ 成功: ${successCount}/${totalBatches} 批`);
        console.log(`❌ 失败: ${failedBatches.length}/${totalBatches} 批`, failedBatches);
        
        // 汇总所有成功批次的结果
        const allResults = {};
        bookBatchState.batches.forEach(batch => {
            if (batch.status === 'success' && batch.results) {
                Object.assign(allResults, batch.results);
            }
        });
        
        console.log('汇总后的翻译结果:', allResults);
        
        if (Object.keys(allResults).length > 0) {
            // 有成功的翻译结果
            if (failedBatches.length > 0) {
                // 有部分批次失败
            isBookTranslationError.value = true;
            canRetryBookTranslation.value = true;
                console.log(`⚠️ 有 ${failedBatches.length} 个批次翻译失败，用户可以选择重试或应用部分结果`);
        }

            // 准备对比数据并显示对比界面
            prepareBookTranslationCompare(allResults, allMissingTags, selectedIndices, fieldsToTranslate);
        } else {
            // 所有批次都失败了
            const badFormatMsg = `所有 ${totalBatches} 个批次翻译均失败，请检查API配置或重试`;
            openErrorModal({
                title: '世界书翻译失败',
                code: 'ALL_BATCHES_FAILED',
                message: badFormatMsg
            });
            isBookTranslationError.value = true;
            canRetryBookTranslation.value = true;
            isBookTranslating.value = false;
            stopTimeTracking();
            return;
        }

    } catch (err) {
        if (err?.name === 'AbortError') {
            console.log('世界书翻译已取消');
            return;
        }
        console.error('世界书批量翻译失败:', err);
        
        // 解析错误信息
        let errorMessage = err.message;
        let errorDetails = null;
        
        try {
            // 尝试解析服务器返回的错误格式
            if (err.message.includes('{')) {
                const errorObj = JSON.parse(err.message);
                if (errorObj.error) {
                    errorDetails = errorObj.error;
                    errorMessage = errorObj.error.message || err.message;
                } else if (errorObj.code || errorObj.type) {
                    errorDetails = errorObj;
                    errorMessage = errorObj.message || err.message;
                }
            }
        } catch (parseErr) {
            console.log('非JSON格式错误，使用原始信息');
        }
        
        // 显示用户友好的错误信息弹窗
        const friendlyMessage = getFriendlyErrorMessage(errorDetails || { message: errorMessage });
        openErrorModal({
            title: '世界书翻译失败',
            code: mapErrorCode(errorDetails || { message: errorMessage }),
            message: friendlyMessage,
            status: errorDetails?.status,
            statusText: errorDetails?.statusText,
            details: errorDetails || { message: errorMessage }
        });
        
        bookTranslationErrors.value.push({
            field: '世界书批量翻译',
            message: errorMessage,
            details: errorDetails
        });
        
        // 设置错误状态，允许重试
        isBookTranslationError.value = true;
        canRetryBookTranslation.value = true;
        isBookTranslating.value = false;
        
        // 停止时间跟踪
        stopTimeTracking();
        
        // 不设置完成状态，因为这是错误情况
        return;
    }

    // 只有在成功的情况下才设置完成状态
    isBookTranslating.value = false;
    isBookTranslationComplete.value = true;
    
    // 停止时间跟踪
    stopTimeTracking();
};

// 显示世界书翻译确认对话框
const showBookTranslationConfirmDialog = (results, missingTags) => {
    return new Promise((resolve) => {
        let message = '世界书翻译完成！\n\n成功翻译的内容：\n';
        
        for (const [entryIndex, fields] of Object.entries(results)) {
            const entryName = editableData.value.book_entries[parseInt(entryIndex)].name || `条目 ${parseInt(entryIndex) + 1}`;
            message += `\n📚 ${entryName}:\n`;
            
            if (fields.name) message += `  ✅ 名称\n`;
            if (fields.keywords) message += `  ✅ 关键词\n`;
            if (fields.content) message += `  ✅ 内容\n`;
        }
        
        if (missingTags.length > 0) {
            message += '\n\n以下内容翻译失败：\n';
            missingTags.forEach(({ field }) => {
                message += `❌ ${field}\n`;
            });
        }
        
        message += '\n是否应用成功的翻译结果？';
        
        const confirmed = confirm(message);
        resolve(confirmed);
    });
};

const cancelBookTranslation = () => {
    cancelBookTranslationFlag.value = true;
    isBookTranslating.value = false;
    isBookTranslationComplete.value = false;

    cancelBookStream();
    bookRequestAbortControllers.value.forEach(controller => controller.abort());
    bookRequestAbortControllers.value = [];
};

const closeBookBatchTranslateModal = () => {
    showBookBatchTranslateModal.value = false;
    isBookTranslating.value = false;
    isBookTranslationComplete.value = false;
    isBookTranslationError.value = false;
    canRetryBookTranslation.value = false;
    bookTranslationErrors.value = [];
    bookTranslationMissingTags.value = [];
    cancelBookTranslationFlag.value = false;
    selectedBookEntries.value = [];
    bookStreamResults.value = [];
    bookRequestAbortControllers.value = [];

    stopTimeTracking();
};

// 重试单个失败的批次
const retryBookBatch = async (batchIndex) => {
    console.log(`🔄 重试批次 ${batchIndex + 1}`);
    
    if (!checkAndPromptApiConfig()) {
        return;
    }
    
    // 获取模态框设置
    const modalSettings = bookBatchTranslateModalRef.value;
    const useStream = modalSettings?.useStreamTranslation ?? false;
    
    // 获取该批次的条目索引
    const batchIndices = bookBatchState.getBatchData(batchIndex);
    if (!batchIndices || batchIndices.length === 0) {
        alert('无法获取该批次的数据');
        return;
    }
    
    // 清除该批次的旧错误
    bookTranslationErrors.value = bookTranslationErrors.value.filter(
        err => !err.field.startsWith(`批次 ${batchIndex + 1}`) && !err.field.startsWith(`批次${batchIndex + 1}`)
    );
    
    // 从流式结果中移除该批次的结果
    bookStreamResults.value = bookStreamResults.value.filter(item => item.batchIndex !== batchIndex);
    
    // 获取要翻译的字段
    const fieldsToTranslate = [];
    if (bookTranslateFields.name) fieldsToTranslate.push('name');
    if (bookTranslateFields.keywords) fieldsToTranslate.push('keywords');
    if (bookTranslateFields.content) fieldsToTranslate.push('content');
    
    // 标记为正在翻译
    bookBatchState.setBatchStatus(batchIndex, 'translating');
    
    try {
        // 构建标签文本
        const { taggedText, fieldMap, totalTags } = buildBookTranslationTags(
            editableData.value.book_entries,
            batchIndices,
            fieldsToTranslate,
            editableData.value
        );
        
        if (!taggedText || totalTags === 0) {
            bookBatchState.setBatchStatus(batchIndex, 'success', { results: {} });
            return;
        }
        
        console.log(`📤 重试批次 ${batchIndex + 1}，包含 ${totalTags} 个字段`);
        
        // 执行翻译（复用相同的逻辑）
        if (useStream) {
            const result = await bookStreamTranslate({
                apiUrl: apiSettings.value.url,
                apiKey: apiSettings.value.key,
                model: apiSettings.value.model,
                systemPrompt: buildTranslationPrompt(translationConfig.value, true) + '\nFor keyword lists separated by commas, translate each keyword and keep the comma separation.',
                userContent: taggedText,
                tagMap: fieldMap,
                onProgress: (progressData) => {
                    if (progressData.completed) {
                        bookStreamResults.value.push({
                            tag: progressData.tag,
                            result: progressData.result,
                            info: progressData.info,
                            batchIndex: batchIndex,
                            selected: true
                        });
                    }
                }
            });
            
            if (result.success) {
                const batchResults = {};
                for (const [tag, content] of Object.entries(result.results)) {
                    const info = fieldMap[tag];
                    if (info) {
                        if (!batchResults[info.entryIndex]) {
                            batchResults[info.entryIndex] = {};
                        }
                        batchResults[info.entryIndex][info.field] = content;
                    }
                }
                bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
                console.log(`✅ 批次 ${batchIndex + 1} 重试成功`);
            } else {
                throw new Error(result.error || '重试失败');
            }
        } else {
            // 普通翻译
            const retryAbortController = new AbortController();
            bookRequestAbortControllers.value.push(retryAbortController);
            const response = await fetch(apiSettings.value.url + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.value.key}`
                },
                signal: retryAbortController.signal,
                body: JSON.stringify({
                    model: apiSettings.value.model,
                    messages: [
                        { 
                            role: 'system', 
                            content: buildTranslationPrompt(translationConfig.value, true) + '\nFor keyword lists separated by commas, translate each keyword and keep the comma separation.'
                        },
                        { role: 'user', content: taggedText }
                    ],
                    temperature: 0.3
                })
            });
            
            bookRequestAbortControllers.value = bookRequestAbortControllers.value.filter(controller => controller !== retryAbortController);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || '请求失败');
            }
            
            const data = await response.json();
            const translatedText = data.choices[0].message.content;
            
            // 解析结果
            const batchResults = {};
            for (const [tag, info] of Object.entries(fieldMap)) {
                const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
                const match = translatedText.match(regex);
                
                if (match && match[1]) {
                    if (!batchResults[info.entryIndex]) {
                        batchResults[info.entryIndex] = {};
                    }
                    batchResults[info.entryIndex][info.field] = match[1].trim();
                }
            }
            
            if (Object.keys(batchResults).length > 0) {
                bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
                console.log(`✅ 批次 ${batchIndex + 1} 重试成功`);
            } else {
                throw new Error('未获取到有效结果');
            }
        }
        
    } catch (error) {
        console.error(`❌ 批次 ${batchIndex + 1} 重试失败:`, error);
        bookBatchState.setBatchStatus(batchIndex, 'error', { error: error.message });
        bookTranslationErrors.value.push({
            field: `批次 ${batchIndex + 1}`,
            message: error.message
        });
    }
};

// 重试所有失败的批次
const retryAllFailedBookBatches = async () => {
    const failedBatchIndices = bookBatchState.getFailedBatches();
    const failedCount = failedBatchIndices.length;
    
    if (failedCount === 0) {
        return;
    }
    
    console.log(`🔄 重试所有 ${failedCount} 个失败的批次:`, failedBatchIndices);
    
    // 获取模态框设置
    const modalSettings = bookBatchTranslateModalRef.value;
    const useConcurrent = modalSettings?.useConcurrentTranslation ?? false;
    
    if (useConcurrent && failedCount > 1) {
        // 并发重试
        console.log('⚡ 并发重试失败的批次');
        const retryPromises = failedBatchIndices.map(index => retryBookBatch(index));
        await Promise.allSettled(retryPromises);
    } else {
        // 串行重试
        console.log('🔄 串行重试失败的批次');
        for (const index of failedBatchIndices) {
            await retryBookBatch(index);
        }
    }
    
    console.log('🎉 所有失败批次重试完成');
};

// 准备翻译对比数据
const prepareTranslationCompare = (results, missingTags, type) => {
    const compareData = [];
    
    if (type === 'basic') {
        // 处理基本字段翻译对比（不包含备选问候语）
        for (const [field, translation] of Object.entries(results)) {
            // 处理普通字段
            const original = editableData.value[field] || '';
            compareData.push({
                field: field,
                original: original,
                translated: translation,
                type: 'basic',
                selected: true,
                displayName: getFieldDisplayName(field)
            });
        }
        
        // 添加翻译失败的字段（显示为不可选择）
        missingTags.forEach(({ field }) => {
            const original = editableData.value[field] || '';
            compareData.push({
                field: field,
                original: original,
                translated: '',
                type: 'basic',
                selected: false,
                failed: true,
                displayName: getFieldDisplayName(field)
            });
        });
    }
    
    // 存储翻译结果供后续应用
    translationResults.value = results;
    translationCompareData.value = compareData;
    
    // 保存最终翻译信息用于对比弹窗
    finalTranslationInfo.value = {
        startTime: formattedStartTime.value,
        duration: translationDuration.value,
        modelName: apiSettings.value.model
    };
    
    // 显示对比模态框
    showCompareModal.value = true;
    
    // 隐藏批量翻译弹窗
    showBatchTranslateModal.value = false;
    
    // 翻译完成，停止进度显示
    isTranslating.value = false;
    isTranslationComplete.value = true;
    stopTimeTracking();
};

// 应用选中的翻译结果
const applySelectedTranslations = (selectedItems) => {
    try {
        pushSnapshot('应用基础翻译');
        selectedItems.forEach(item => {
            if (!item.failed && item.translated) {
                // 处理普通字段（基本信息批量翻译中不再处理备选问候语）
                editableData.value[item.field] = item.translated;
            }
        });
        
        console.log('已应用选中的翻译结果');
        showCompareModal.value = false;
        
        // 不要立即关闭批量翻译模态框，让用户看到完成状态
        // closeBatchTranslateModal();
        
    } catch (error) {
        console.error('应用翻译结果失败:', error);
        alert('应用翻译结果时发生错误：' + error.message);
    }
};

// 预览翻译更改
const previewTranslationChanges = (selectedItems) => {
    let message = '将要应用以下翻译更改：\n\n';
    
    selectedItems.forEach(item => {
        const fieldName = getFieldDisplayName(item.field);
        message += `📝 ${fieldName}:\n`;
        message += `   原文: ${item.original.substring(0, 50)}${item.original.length > 50 ? '...' : ''}\n`;
        message += `   译文: ${item.translated.substring(0, 50)}${item.translated.length > 50 ? '...' : ''}\n\n`;
    });
    
    alert(message);
};

// 字段显示名称映射
const getFieldDisplayName = (field) => {
    const fieldNames = {
        name: '角色名称',
        description: '角色描述',
        personality: '性格特征',
        scenario: '背景场景',
        first_message: '首次问候',
        message_example: '示例对话',
        keywords: '关键词',
        content: '条目内容'
    };
    return fieldNames[field] || field;
};

// 准备世界书翻译对比数据
const prepareBookTranslationCompare = (results, missingTags, selectedIndices, fieldsToTranslate) => {
    console.log('prepareBookTranslationCompare 被调用');
    console.log('results:', results);
    console.log('missingTags:', missingTags);
    
    const compareData = [];
    
    // 处理成功翻译的内容
    for (const [entryIndex, fields] of Object.entries(results)) {
        const entry = editableData.value.book_entries[parseInt(entryIndex)];
        const entryName = entry.name || `条目 ${parseInt(entryIndex) + 1}`;
        
        Object.entries(fields).forEach(([field, translation]) => {
            let original = '';
            let fieldKey = `${entryIndex}-${field}`;
            
            if (field === 'name') {
                original = entry.name || '';
            } else if (field === 'keywords') {
                original = entry.keysText || '';
            } else if (field === 'content') {
                original = entry.content || '';
            }
            
            compareData.push({
                field: fieldKey,
                entryIndex: parseInt(entryIndex),
                entryName: entryName,
                fieldType: field,
                original: original,
                translated: translation,
                type: 'worldbook',
                selected: true,
                displayName: `${entryName} - ${getFieldDisplayName(field)}`
            });
        });
    }
    
    // 添加翻译失败的字段
    missingTags.forEach(({ field }) => {
        // 解析field中的条目信息
        const parts = field.split(' - ');
        if (parts.length === 2) {
            const entryName = parts[0];
            const fieldName = parts[1];
            
            compareData.push({
                field: `failed-${field}`,
                entryName: entryName,
                fieldType: fieldName,
                original: '',
                translated: '',
                type: 'worldbook',
                selected: false,
                failed: true
            });
        }
    });
    
    // 存储翻译结果供后续应用
    translationResults.value = results;
    translationCompareData.value = compareData;
    
    console.log('准备显示对比模态框');
    console.log('compareData:', compareData);
    console.log('showCompareModal 设置为 true');
    
    // 保存最终翻译信息用于对比弹窗
    finalTranslationInfo.value = {
        startTime: formattedBookStartTime.value,
        duration: bookTranslationDuration.value,
        modelName: apiSettings.value.model
    };
    
    // 显示对比模态框
    showCompareModal.value = true;
    
    // 隐藏世界书批量翻译弹窗
    showBookBatchTranslateModal.value = false;
    
    // 翻译完成，停止进度显示
    isBookTranslating.value = false;
    isBookTranslationComplete.value = true;
    stopTimeTracking();
};

// 应用选中的世界书翻译结果
const applySelectedBookTranslations = (selectedItems) => {
    try {
        pushSnapshot('应用世界书翻译');
        selectedItems.forEach(item => {
            if (!item.failed && item.translated && item.entryIndex !== undefined) {
                const entry = editableData.value.book_entries[item.entryIndex];
                
                if (item.fieldType === 'name') {
                    entry.name = item.translated;
                } else if (item.fieldType === 'keywords') {
                    entry.keysText = item.translated;
                    // 更新keys数组
                    entry.keys = item.translated.split(',').map(k => k.trim()).filter(Boolean);
                } else if (item.fieldType === 'content') {
                    entry.content = item.translated;
                }
            }
        });
        
        console.log('已应用选中的世界书翻译结果');
        showCompareModal.value = false;
        
        // 不要立即关闭世界书批量翻译模态框，让用户看到完成状态
        // closeBookBatchTranslateModal();
        
    } catch (error) {
        console.error('应用世界书翻译结果失败:', error);
        alert('应用翻译结果时发生错误：' + error.message);
    }
};

// 处理对比模态框事件
const handleCompareApply = (selectedItems) => {
    const currentType = translationCompareData.value[0]?.type;
    
    if (currentType === 'basic') {
        applySelectedTranslations(selectedItems);
    } else if (currentType === 'worldbook') {
        applySelectedBookTranslations(selectedItems);
    } else if (currentType === 'advanced') {
        applySelectedAdvancedTranslations(selectedItems);
    }
};

const handleComparePreview = (selectedItems) => {
    const currentType = translationCompareData.value[0]?.type;
    
    if (currentType === 'basic') {
        previewTranslationChanges(selectedItems);
    } else if (currentType === 'worldbook') {
        // 世界书预览
        let message = '将要应用以下翻译更改：\n\n';
        
        selectedItems.forEach(item => {
            message += `📚 ${item.entryName} - ${getFieldDisplayName(item.fieldType)}:\n`;
            message += `   原文: ${item.original.substring(0, 50)}${item.original.length > 50 ? '...' : ''}\n`;
            message += `   译文: ${item.translated.substring(0, 50)}${item.translated.length > 50 ? '...' : ''}\n\n`;
        });
        
        alert(message);
    } else if (currentType === 'advanced') {
        // 高级设置预览
        let message = '将要应用以下翻译更改：\n\n';
        
        selectedItems.forEach(item => {
            message += `⚙️ ${item.displayName}:\n`;
            message += `   原文: ${item.original.substring(0, 50)}${item.original.length > 50 ? '...' : ''}\n`;
            message += `   译文: ${item.translated.substring(0, 50)}${item.translated.length > 50 ? '...' : ''}\n\n`;
        });
        
        alert(message);
    }
};

const handleCompareClose = () => {
    showCompareModal.value = false;
    translationCompareData.value = [];
    translationResults.value = null;
    
    // 清理最终翻译信息
    finalTranslationInfo.value = {
        startTime: '',
        duration: '',
        modelName: ''
    };
};

// 高级设置批量翻译
const startAdvancedBatchTranslation = async () => {
    console.log('开始高级设置批量翻译');
    
    // 检查是否有选中的字段
    if (!hasAdvancedSelectedFields.value) {
        alert('请至少选择一个要翻译的字段！');
        return;
    }
    
    // 初始化状态
    advancedTranslatedCount.value = 0;
    advancedTranslationErrors.value = [];
    isAdvancedTranslating.value = true;
    isAdvancedTranslationComplete.value = false;
    isAdvancedTranslationError.value = false;
    canRetryAdvancedTranslation.value = false;
    cancelAdvancedTranslationFlag.value = false;
    
    // 开始时间跟踪
    startAdvancedTimeTracking();
    
    try {
        // 准备翻译数据  
        const fieldsToTranslate = [];
        let totalFields = 0;
        
        // 收集需要翻译的字段
        Object.entries(advancedTranslateFields).forEach(([field, selected]) => {
            if (selected) {
                if (field === 'alternate_greetings') {
                    // 处理备选问候语数组
                    if (Array.isArray(editableData.value.alternate_greetings) && editableData.value.alternate_greetings.length > 0) {
                        editableData.value.alternate_greetings.forEach((greeting, index) => {
                            // 仅加入被勾选的问候语
                            if (selectedAlternateGreetings.value[index] && greeting && greeting.trim()) {
                                fieldsToTranslate.push({
                                    type: 'alternate_greeting',
                                    field: 'alternate_greetings',
                                    index: index,
                                    content: greeting.trim()
                                });
                                totalFields++;
                            }
                        });
                    }
                } else if (editableData.value[field] && editableData.value[field].trim()) {
                    // 处理普通字段
                    fieldsToTranslate.push({
                        type: 'normal',
                        field: field,
                        content: editableData.value[field].trim()
                    });
                    totalFields++;
                }
            }
        });
        
        if (fieldsToTranslate.length === 0) {
            alert('没有找到需要翻译的内容！');
            isAdvancedTranslating.value = false;
            stopTimeTracking();
            return;
        }
        
        advancedTotalToTranslate.value = totalFields;
        
        // 构建翻译请求
        let translationText = '';
        let tagIndex = 1;
        const fieldTagMap = {};
        
        fieldsToTranslate.forEach((item, index) => {
            const tag = `TXT${tagIndex}`;
            fieldTagMap[tag] = item;
            translationText += `<${tag}>${item.content}</${tag}>\n\n`;
            tagIndex++;
        });
        
        console.log('发送翻译请求:', translationText);
        
        // 单次API请求翻译所有内容
        advancedTranslationAbortController.value = new AbortController();
        const response = await fetch(apiSettings.value.url + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.value.key}`
            },
            signal: advancedTranslationAbortController.value.signal,
            body: JSON.stringify({
                model: apiSettings.value.model,
                messages: [
                    { 
                        role: 'system', 
                        content: buildTranslationPrompt(translationConfig.value, true)
                    },
                    { role: 'user', content: translationText }
                ],
                temperature: 0.3
            })
        });
        advancedTranslationAbortController.value = null;
        
        if (!response.ok) {
            const errData = await response.json();
            // 保存完整的错误信息
            const errorInfo = {
                status: response.status,
                statusText: response.statusText,
                ...errData.error
            };
            const errorMessage = JSON.stringify(errorInfo, null, 2);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error('API未返回任何结果');
        }

        const result = { translation: data.choices[0].message.content };
        
        if (cancelAdvancedTranslationFlag.value) {
            console.log('高级设置翻译被用户取消');
            return;
        }
        
        // 解析翻译结果
        const results = {};
        const missingTags = [];
        const expectedTags = Object.keys(fieldTagMap);
        
        Object.entries(fieldTagMap).forEach(([tag, item]) => {
            const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
            const match = result.translation.match(regex);
            
            if (match && match[1] && match[1].trim()) {
                if (item.type === 'alternate_greeting') {
                    // 处理备选问候语
                    if (!results.alternate_greetings) {
                        results.alternate_greetings = [];
                    }
                    results.alternate_greetings[item.index] = match[1].trim();
                } else {
                    // 处理普通字段
                    results[item.field] = match[1].trim();
                }
                advancedTranslatedCount.value++;
            } else {
                const fieldDisplayName = item.type === 'alternate_greeting' 
                    ? `备选问候语 ${item.index + 1}` 
                    : getAdvancedFieldDisplayName(item.field);
                missingTags.push({ 
                    field: fieldDisplayName, 
                    tag,
                    item: item  // 保存原始item信息
                });
            }
        });
        
        console.log('高级设置翻译结果:', results);
        console.log('丢失的标签:', missingTags);
        
        // 若返回不符合预期格式
        const resultKeys = Object.keys(results);
        const allMissing = missingTags.length === expectedTags.length;
        const noUseful = resultKeys.length === 0 || (resultKeys.length === 1 && resultKeys[0] === 'alternate_greetings' && (!Array.isArray(results.alternate_greetings) || results.alternate_greetings.filter(Boolean).length === 0));
        if (allMissing || noUseful) {
            const badFormatMsg = '返回结果未遵循预期返回格式，请重试';
            openErrorModal({
                title: '高级设置翻译失败',
                code: 'BAD_FORMAT',
                message: badFormatMsg,
                details: { expectedTags, translatedText: result.translation?.slice(0, 800) }
            });
            advancedTranslationErrors.value.push({ field: '高级设置批量翻译', message: badFormatMsg });
            isAdvancedTranslationError.value = true;
            canRetryAdvancedTranslation.value = true;
            isAdvancedTranslating.value = false;
            stopTimeTracking();
            return;
        }

        // 记录丢失的标签作为错误
        if (missingTags.length > 0) {
            missingTags.forEach(({ field, tag, item }) => {
                advancedTranslationErrors.value.push({
                    field: field,
                    message: `标签 ${tag} 在返回结果中丢失`,
                    details: item  // 保存原始item信息
                });
            });
        }
        
        // 准备翻译对比数据
        prepareAdvancedTranslationCompare(results, missingTags);
        
    } catch (err) {
        if (err?.name === 'AbortError') {
            console.log('高级设置翻译已取消');
            return;
        }
        console.error('高级设置批量翻译失败:', err);
        
        // 解析错误信息
        let errorMessage = err.message;
        let errorDetails = null;
        
        try {
            // 尝试解析服务器返回的错误格式
            if (err.message.includes('{')) {
                const errorObj = JSON.parse(err.message);
                if (errorObj.error) {
                    errorDetails = errorObj.error;
                    errorMessage = errorObj.error.message || err.message;
                } else if (errorObj.code || errorObj.type) {
                    errorDetails = errorObj;
                    errorMessage = errorObj.message || err.message;
                }
            }
        } catch (parseErr) {
            console.log('非JSON格式错误，使用原始信息');
        }
        
        // 显示用户友好的错误信息弹窗
        const friendlyMessage = getFriendlyErrorMessage(errorDetails || { message: errorMessage });
        openErrorModal({
            title: '高级设置翻译失败',
            code: mapErrorCode(errorDetails || { message: errorMessage }),
            message: friendlyMessage,
            status: errorDetails?.status,
            statusText: errorDetails?.statusText,
            details: errorDetails || { message: errorMessage }
        });
        
        advancedTranslationErrors.value.push({
            field: '高级设置批量翻译',
            message: errorMessage,
            details: errorDetails
        });
        
        // 设置错误状态，允许重试
        isAdvancedTranslationError.value = true;
        canRetryAdvancedTranslation.value = true;
        isAdvancedTranslating.value = false;
        
        // 停止时间跟踪
        stopTimeTracking();
        
        // 不设置完成状态，因为这是错误情况
        return;
    }
    
    // 只有在成功的情况下才设置完成状态
    isAdvancedTranslating.value = false;
    isAdvancedTranslationComplete.value = true;
    
    // 停止时间跟踪
    stopTimeTracking();
};

// 准备高级设置翻译对比数据
const prepareAdvancedTranslationCompare = (results, missingTags) => {
    const compareData = [];
    
    // 处理成功翻译的内容
    Object.entries(results).forEach(([field, translation]) => {
        if (field === 'alternate_greetings' && Array.isArray(translation)) {
            // 处理备选问候语数组
            translation.forEach((greetingTranslation, index) => {
                if (greetingTranslation) {
                    const original = editableData.value.alternate_greetings?.[index] || '';
                    compareData.push({
                        field: 'alternate_greetings',
                        index: index,
                        original: original,
                        translated: greetingTranslation,
                        type: 'advanced',
                        selected: true,
                        displayName: `备选问候语 ${index + 1}`
                    });
                }
            });
        } else {
            // 处理普通字段
            const original = editableData.value[field] || '';
            compareData.push({
                field: field,
                original: original,
                translated: translation,
                type: 'advanced',
                selected: true,
                displayName: getAdvancedFieldDisplayName(field)
            });
        }
    });
    
    // 添加翻译失败的字段
    missingTags.forEach(({ field, tag, item }) => {
        if (item && item.type === 'alternate_greeting') {
            // 处理失败的备选问候语
            const original = editableData.value.alternate_greetings?.[item.index] || '';
            compareData.push({
                field: 'alternate_greetings',
                index: item.index,
                original: original,
                translated: '',
                type: 'advanced',
                selected: false,
                failed: true,
                displayName: `备选问候语 ${item.index + 1}`,
                details: item
            });
        } else {
            // 处理失败的普通字段
            const original = editableData.value[field] || '';
            compareData.push({
                field: field,
                original: original,
                translated: '',
                type: 'advanced',
                selected: false,
                failed: true,
                displayName: getAdvancedFieldDisplayName(field),
                details: item
            });
        }
    });
    
    // 存储翻译结果供后续应用
    translationResults.value = results;
    translationCompareData.value = compareData;
    
    // 保存最终翻译信息用于对比弹窗
    finalTranslationInfo.value = {
        startTime: formattedAdvancedStartTime.value,
        duration: advancedTranslationDuration.value,
        modelName: apiSettings.value.model
    };
    
    // 显示对比模态框
    showCompareModal.value = true;
    
    // 隐藏高级设置批量翻译弹窗
    showAdvancedBatchTranslateModal.value = false;
    
    // 翻译完成，停止进度显示
    isAdvancedTranslating.value = false;
    isAdvancedTranslationComplete.value = true;
    stopTimeTracking();
};

// 应用选中的高级设置翻译结果
const applySelectedAdvancedTranslations = (selectedItems) => {
    try {
        pushSnapshot('应用高级设置翻译');
        selectedItems.forEach(item => {
            if (!item.failed && item.translated) {
                if (item.field === 'alternate_greetings' && item.index !== undefined) {
                    // 处理备选问候语
                    if (!editableData.value.alternate_greetings) {
                        editableData.value.alternate_greetings = [];
                    }
                    editableData.value.alternate_greetings[item.index] = item.translated;
                } else {
                    // 处理普通字段
                    editableData.value[item.field] = item.translated;
                }
            }
        });
        
        console.log('已应用选中的高级设置翻译结果');
        showCompareModal.value = false;
        
    } catch (error) {
        console.error('应用高级设置翻译结果失败:', error);
        alert('应用翻译结果时发生错误：' + error.message);
    }
};

// 高级设置字段显示名称映射
const getAdvancedFieldDisplayName = (field) => {
    const fieldNames = {
        system_prompt: '系统提示词',
        post_history_instructions: '历史后指令',
        creator_notes: '作者备注',
        alternate_greetings: '备选问候语'
    };
    return fieldNames[field] || field;
};

// 取消高级设置翻译
const cancelAdvancedTranslation = () => {
    cancelAdvancedTranslationFlag.value = true;
    advancedTranslationAbortController.value?.abort();
    advancedTranslationAbortController.value = null;
    isAdvancedTranslating.value = false;
    isAdvancedTranslationComplete.value = false;
};

// 关闭高级设置批量翻译模态框
const closeAdvancedBatchTranslateModal = () => {
    showAdvancedBatchTranslateModal.value = false;
    // 重置状态
    isAdvancedTranslating.value = false;
    isAdvancedTranslationComplete.value = false;
    isAdvancedTranslationError.value = false;
    canRetryAdvancedTranslation.value = false;
    advancedTranslationErrors.value = [];
    cancelAdvancedTranslationFlag.value = false;
    selectedAlternateGreetings.value = [];
    
    // 确保停止时间跟踪
    stopTimeTracking();
};

// 全局替换功能函数
const checkOccurrences = () => {
    if (!replaceForm.originalText || !editableData.value) {
        occurrenceCount.value = 0;
        occurrenceDetails.value = [];
        return;
    }
    
    const searchText = replaceForm.originalText;
    let totalCount = 0;
    const details = [];
    
    // 定义要搜索的字段及其显示名称
    const fieldsToSearch = [
        { key: 'name', name: '角色名称' },
        { key: 'description', name: '描述' },
        { key: 'personality', name: '性格' },
        { key: 'scenario', name: '场景' },
        { key: 'first_message', name: '首次问候' },
        { key: 'message_example', name: '示例对话' },
        { key: 'system_prompt', name: '系统提示词' },
        { key: 'post_history_instructions', name: '历史后指令' },
        { key: 'creator_notes', name: '作者备注' }
    ];
    
    // 搜索普通字段
    fieldsToSearch.forEach(field => {
        const fieldValue = editableData.value[field.key];
        if (fieldValue && typeof fieldValue === 'string') {
            const matches = fieldValue.split(searchText).length - 1;
            if (matches > 0) {
                totalCount += matches;
                
                // 创建预览文本
                const index = fieldValue.indexOf(searchText);
                const start = Math.max(0, index - 20);
                const end = Math.min(fieldValue.length, index + searchText.length + 20);
                const preview = (start > 0 ? '...' : '') + 
                               fieldValue.substring(start, end) + 
                               (end < fieldValue.length ? '...' : '');
                
                details.push({
                    field: field.key,
                    fieldName: field.name,
                    count: matches,
                    preview: preview
                });
            }
        }
    });
    
    // 搜索备选问候语
    if (Array.isArray(editableData.value.alternate_greetings)) {
        editableData.value.alternate_greetings.forEach((greeting, index) => {
            if (greeting && typeof greeting === 'string') {
                const matches = greeting.split(searchText).length - 1;
                if (matches > 0) {
                    totalCount += matches;
                    
                    const greetingIndex = greeting.indexOf(searchText);
                    const start = Math.max(0, greetingIndex - 20);
                    const end = Math.min(greeting.length, greetingIndex + searchText.length + 20);
                    const preview = (start > 0 ? '...' : '') + 
                                   greeting.substring(start, end) + 
                                   (end < greeting.length ? '...' : '');
                    
                    details.push({
                        field: `alternate_greetings_${index}`,
                        fieldName: `备选问候语 ${index + 1}`,
                        count: matches,
                        preview: preview
                    });
                }
            }
        });
    }
    
    // 搜索世界书条目
    if (Array.isArray(editableData.value.book_entries)) {
        editableData.value.book_entries.forEach((entry, index) => {
            // 搜索条目名称
            if (entry.name && typeof entry.name === 'string') {
                const matches = entry.name.split(searchText).length - 1;
                if (matches > 0) {
                    totalCount += matches;
                    details.push({
                        field: `book_entry_${index}_name`,
                        fieldName: `世界书条目 ${index + 1} - 名称`,
                        count: matches,
                        preview: entry.name
                    });
                }
            }
            
            // 搜索条目内容
            if (entry.content && typeof entry.content === 'string') {
                const matches = entry.content.split(searchText).length - 1;
                if (matches > 0) {
                    totalCount += matches;
                    
                    const contentIndex = entry.content.indexOf(searchText);
                    const start = Math.max(0, contentIndex - 20);
                    const end = Math.min(entry.content.length, contentIndex + searchText.length + 20);
                    const preview = (start > 0 ? '...' : '') + 
                                   entry.content.substring(start, end) + 
                                   (end < entry.content.length ? '...' : '');
                    
                    details.push({
                        field: `book_entry_${index}_content`,
                        fieldName: `世界书条目 ${index + 1} - 内容`,
                        count: matches,
                        preview: preview
                    });
                }
            }
            
            // 搜索关键词
            if (entry.keysText && typeof entry.keysText === 'string') {
                const matches = entry.keysText.split(searchText).length - 1;
                if (matches > 0) {
                    totalCount += matches;
                    details.push({
                        field: `book_entry_${index}_keys`,
                        fieldName: `世界书条目 ${index + 1} - 关键词`,
                        count: matches,
                        preview: entry.keysText
                    });
                }
            }
        });
    }
    
    occurrenceCount.value = totalCount;
    occurrenceDetails.value = details;
};

const executeGlobalReplace = () => {
    if (!replaceForm.originalText || !editableData.value) {
        alert('请填写原文本！');
        return;
    }
    
    pushSnapshot('执行全局替换');
    const searchText = replaceForm.originalText;
    const newText = replaceForm.newText ?? '';
    let totalReplaced = 0;
    
    // 定义要替换的字段
    const fieldsToReplace = [
        'name', 'description', 'personality', 'scenario', 
        'first_message', 'message_example', 'system_prompt', 
        'post_history_instructions', 'creator_notes'
    ];
    
    // 替换普通字段
    fieldsToReplace.forEach(field => {
        const fieldValue = editableData.value[field];
        if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes(searchText)) {
            const beforeCount = fieldValue.split(searchText).length - 1;
            editableData.value[field] = fieldValue.replaceAll(searchText, newText);
            totalReplaced += beforeCount;
        }
    });
    
    // 替换备选问候语
    if (Array.isArray(editableData.value.alternate_greetings)) {
        editableData.value.alternate_greetings.forEach((greeting, index) => {
            if (greeting && typeof greeting === 'string' && greeting.includes(searchText)) {
                const beforeCount = greeting.split(searchText).length - 1;
                editableData.value.alternate_greetings[index] = greeting.replaceAll(searchText, newText);
                totalReplaced += beforeCount;
            }
        });
    }
    
    // 替换世界书条目
    if (Array.isArray(editableData.value.book_entries)) {
        editableData.value.book_entries.forEach((entry, index) => {
            // 替换条目名称
            if (entry.name && typeof entry.name === 'string' && entry.name.includes(searchText)) {
                const beforeCount = entry.name.split(searchText).length - 1;
                entry.name = entry.name.replaceAll(searchText, newText);
                totalReplaced += beforeCount;
            }
            
            // 替换条目内容
            if (entry.content && typeof entry.content === 'string' && entry.content.includes(searchText)) {
                const beforeCount = entry.content.split(searchText).length - 1;
                entry.content = entry.content.replaceAll(searchText, newText);
                totalReplaced += beforeCount;
            }
            
            // 替换关键词
            if (entry.keysText && typeof entry.keysText === 'string' && entry.keysText.includes(searchText)) {
                const beforeCount = entry.keysText.split(searchText).length - 1;
                entry.keysText = entry.keysText.replaceAll(searchText, newText);
                // 同时更新keys数组
                entry.keys = entry.keysText.split(',').map(k => k.trim()).filter(Boolean);
                totalReplaced += beforeCount;
            }
        });
    }
    
    alert(`替换完成！共替换了 ${totalReplaced} 处文本。`);
    
    // 重置表单并关闭模态框
    replaceForm.originalText = '';
    replaceForm.newText = '';
    occurrenceCount.value = 0;
    occurrenceDetails.value = [];
    showGlobalReplaceModal.value = false;
};

const closeGlobalReplaceModal = () => {
    showGlobalReplaceModal.value = false;
    replaceForm.originalText = '';
    replaceForm.newText = '';
    occurrenceCount.value = 0;
    occurrenceDetails.value = [];
};
</script>


<style scoped>
.snapshot-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.snapshot-button {
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    cursor: pointer;
}

.snapshot-button.secondary {
    background: #475569;
}

.snapshot-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.snapshot-tip {
    margin-bottom: 10px;
    color: #64748b;
    font-size: 13px;
}
</style>
