<template>
    <div class="container">
        <div class="header-controls">
            <div class="header-copy">
                <p class="page-kicker">Character Card Workspace</p>
                <h1>角色卡解析翻译器</h1>
                <p class="page-subtitle">面向长文本角色卡与世界书的编辑、翻译、快照和导出工作台。</p>
            </div>

            <div class="header-buttons">
                <span class="version-chip">当前版本 {{ currentVersion.toUpperCase() }}</span>
                <button type="button" @click="showChangelogModal = true" class="tool-button">更新日志</button>
            </div>
        </div>

        <NotificationBanner
            :show="operationNotice.visible"
            :type="operationNotice.type"
            :title="operationNotice.title"
            :message="operationNotice.message"
            @close="clearOperationNotice"
        />

        <div class="upload-area">
            <div class="workspace-toolbar">
                <div class="upload-stack">
                    <label for="file-upload" class="upload-button">选择角色卡（PNG / JSON）</label>
                    <input id="file-upload" type="file" accept="image/png,application/json,.json" @change="handleFileUpload" class="hidden" />
                    <button type="button" @click="openCharacterAICreateModal" class="tool-button">从 0 创建角色卡</button>
                    <p v-if="fileName" class="file-name">已选择：{{ fileName }}</p>
                    <p v-else class="file-hint">支持 PNG 角色卡 与 JSON 角色卡；也可不选文件，直接用提示词从 0 创建角色卡。</p>
                </div>

                <div class="workspace-actions">
                    <div class="toolbar-cluster utility-tools">
                        <button type="button" @click="showPromptModal = true" class="tool-button">翻译提示词</button>
                        <button type="button" @click="showJailbreakModal = true" class="tool-button">破限提示词</button>
                        <button type="button" @click="showSettingsModal = true" class="tool-button">设置</button>
                        <router-link to="/stream" class="tool-button">流式测试</router-link>
                    </div>

                    <div v-if="characterData" class="toolbar-cluster file-tools">
                        <button type="button" @click="saveManualSnapshot" class="snapshot-button">保存快照</button>
                        <button type="button" @click="undoLastSnapshot" class="snapshot-button secondary" :disabled="!canUndoSnapshot">撤销</button>
                        <button type="button" @click="restoreInitialSnapshot" class="snapshot-button secondary" :disabled="!canRestoreInitialSnapshot">恢复初始</button>
                        <label for="cover-upload" class="tool-button">替换 / 增加封面</label>
                        <input id="cover-upload" type="file" accept="image/png,image/jpeg,image/webp" @change="handleCoverUpload" class="hidden" />
                        <button type="button" @click="clearCoverImage" class="tool-button" :disabled="!hasCustomCover">移除封面</button>
                        <span v-if="snapshotMeta.currentLabel" class="snapshot-chip">当前快照：{{ snapshotMeta.currentLabel }}</span>
                        <button type="button" @click="exportCharacterCard" class="export-button">导出角色卡</button>
                    </div>
                </div>
            </div>
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
                    <img :src="displayImagePreview" alt="角色预览" />
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
                        @open-ai-generate="openWorldBookAIGenerateModal"
                        @open-ai-patch="openWorldBookAIPatchModal"
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

        </div>
        
        <CharacterAICreateModal
            :show="showCharacterAICreateModal"
            :isGenerating="isCharacterAICreating"
            :generationStageLabel="characterAICreationStageLabel"
            :form="characterAICreateForm"
            :draft="characterAICreateDraft"
            :warnings="characterAICreateWarnings"
            :retryFailures="characterAICreateRetryFailures"
            @close="closeCharacterAICreateModal"
            @generate="handleGenerateCharacterAIDraft"
            @retry-failed="handleRetryCharacterAIFailedEntries"
            @apply="handleApplyCharacterAIDraft"
        />

        <ChangelogModal :show="showChangelogModal" :entries="changelogEntries" @close="showChangelogModal = false" />
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

        <WorldBookAIGenerateModal
            :show="showWorldBookAIGenerateModal"
            :isGenerating="isWorldBookAIGenerating"
            :form="worldBookAIGenerateForm"
            :draft="worldBookAIDraft"
            :warnings="worldBookAIWarnings"
            @close="closeWorldBookAIGenerateModal"
            @generate="handleGenerateWorldBookAIDraft"
            @apply="handleApplyWorldBookAIDraft"
        />

        <WorldBookAIPatchModal
            :show="showWorldBookAIPatchModal"
            :isGenerating="isWorldBookAIPatching"
            :form="worldBookAIPatchForm"
            :plannerPreview="worldBookAIPatchPlannerPreview"
            :preview="worldBookAIPatchPreview"
            :entries="editableData?.book_entries || []"
            @close="closeWorldBookAIPatchModal"
            @generate-planner="handleGenerateWorldBookAIPatchPlannerPreview"
            @generate="handleGenerateWorldBookAIPatchPreview"
            @apply="handleApplyWorldBookAIPatch"
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
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import BasicInfoTab from '@/components/tabs/BasicInfoTab.vue';
import AdvancedSettingsTab from '@/components/tabs/AdvancedSettingsTab.vue';
import WorldBookTab from '@/components/tabs/WorldBookTab.vue';
import { buildTranslationPrompt, getFriendlyErrorMessage, mapErrorCode } from '@/utils/translationHelpers';
import SettingsModal from '../components/SettingsModal.vue';
import TranslationPromptModal from '../components/TranslationPromptModal.vue';
import JailbreakTextModal from '../components/JailbreakTextModal.vue';
import TranslationCompareModal from '../components/TranslationCompareModal.vue';
import BatchTranslateModal from '@/components/modals/BatchTranslateModal.vue';
import BookBatchTranslateModal from '@/components/modals/BookBatchTranslateModal.vue';
import CharacterAICreateModal from '@/components/modals/CharacterAICreateModal.vue';
import ChangelogModal from '@/components/modals/ChangelogModal.vue';
import { CHANGELOG_ENTRIES, CURRENT_VERSION } from '@/data/changelog';
import WorldBookAIGenerateModal from '@/components/modals/WorldBookAIGenerateModal.vue';
import WorldBookAIPatchModal from '@/components/modals/WorldBookAIPatchModal.vue';
import AdvancedBatchTranslateModal from '@/components/modals/AdvancedBatchTranslateModal.vue';
import GlobalReplaceModal from '@/components/modals/GlobalReplaceModal.vue';
import ErrorModal from '@/components/modals/ErrorModal.vue';
import NotificationBanner from '@/components/common/NotificationBanner.vue';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';
import { CharacterCardUtils } from '@/utils/characterCardParser';
import { useStreamTranslation } from '@/composables/useStreamTranslation';
import { useOperationFeedback } from '@/composables/useOperationFeedback';
import { useGlobalReplace } from '@/composables/useGlobalReplace';
import { useCharacterExport } from '@/composables/useCharacterExport';
import { useErrorDetails } from '@/composables/useErrorDetails';
import { useTranslationCompare } from '@/composables/useTranslationCompare';
import { useSnapshotHistory } from '@/composables/useSnapshotHistory';
import { useTranslationTiming } from '@/composables/useTranslationTiming';
import { useCharacterEditor } from '@/composables/useCharacterEditor';
import { useBasicTranslation } from '@/composables/useBasicTranslation';
import { useAdvancedTranslationActions } from '@/composables/useAdvancedTranslationActions';
import { useWorldBookActions } from '@/composables/useWorldBookActions';
import { useCharacterAICreation } from '@/composables/useCharacterAICreation';
import { useWorldBookAIGeneration } from '@/composables/useWorldBookAIGeneration';
import { useWorldBookAIPatch } from '@/composables/useWorldBookAIPatch';
import { splitIntoBatches, buildBookTranslationTags, BatchState } from '@/utils/batchTranslationHelper';
import { executeWorldBookBatch } from '@/utils/worldBookBatchExecutor';
import {
    collectBookBatchResults,
    countBookTranslationItems,
    getBookFieldsToTranslate,
    getSelectedBookIndices,
    normalizeWorldBookMissingItems,
} from '@/utils/worldBookTranslationWorkflow';

const appStore = useAppStore();
const { apiSettings, translationConfig } = storeToRefs(appStore);

// 检查API配置并显示友好提示
const checkAndPromptApiConfig = () => {
    if (!apiSettings.value.url || !apiSettings.value.model) {
        showSettingsModal.value = true;
        showOperationNotice({
            type: 'warning',
            title: '请先配置 API',
            message: '已为你打开设置面板，请先填写 API URL、模型与密钥。',
            duration: 6000,
        });
        return false;
    }
    return true;
};

const DEFAULT_COVER_IMAGE_DATA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5f5f4"/>
      <stop offset="100%" stop-color="#e7e5e4"/>
    </linearGradient>
  </defs>
  <rect width="640" height="900" fill="url(#g)"/>
  <rect x="52" y="72" width="536" height="756" rx="26" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
  <text x="320" y="410" font-size="36" text-anchor="middle" fill="#57534e" font-family="Arial, sans-serif">角色卡封面</text>
  <text x="320" y="462" font-size="22" text-anchor="middle" fill="#a8a29e" font-family="Arial, sans-serif">可上传替换</text>
</svg>
`);

const fileName = ref('');
const imagePreview = ref('');
const imagePreviewObjectUrl = ref('');
const originalFileBytes = ref(null); // 保存原始文件字节数据用于导出
const characterData = ref(null);
const editableData = ref(null); // 可编辑的数据副本
const isLoading = ref(false);
const error = ref('');
const activeTab = ref('basic');
const showSettingsModal = ref(false);
const showPromptModal = ref(false);
const showJailbreakModal = ref(false);
const showCharacterAICreateModal = ref(false);
const showChangelogModal = ref(false);
const currentVersion = CURRENT_VERSION;
const changelogEntries = CHANGELOG_ENTRIES;
const characterAICreateForm = reactive({
    corePrompt: '',
    genre: '',
    style: '',
    relationshipTone: '',
    generationMode: 'two_step',
    targetEntryCount: 16,
    openingCount: 3,
    notes: '',
    applyOpeningsToGreetings: true,
});

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

// 世界书 AI 代写相关变量
const showWorldBookAIGenerateModal = ref(false);
const worldBookAIGenerateForm = reactive({
    premise: '',
    genre: '',
    style: '',
    protagonist: '',
    targetEntryCount: 16,
    openingCount: 3,
    notes: '',
    replaceExisting: false,
    applyOpeningsToGreetings: true,
});

const showWorldBookAIPatchModal = ref(false);
const worldBookAIPatchForm = reactive({
    entryId: '',
    scope: 'paragraph',
    mode: 'rewrite',
    field: 'content',
    paragraphIndex: 0,
    instruction: '',
    keepStyle: true,
    allowRelatedEntries: false,
    confirmReviewedDiff: false,
});

// 世界书流式翻译和分批支持
const bookBatchTranslateModalRef = ref(null); // 模态框引用
const bookBatchState = new BatchState(); // 批次状态管理
const {
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

watch(() => editableData.value?.book_entries, (entries) => {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
        worldBookAIPatchForm.entryId = '';
        return;
    }

    const matched = list.some(entry => String(entry.id) === String(worldBookAIPatchForm.entryId));
    if (!matched) {
        worldBookAIPatchForm.entryId = String(list[0].id);
    }
}, { deep: true });

watch(() => worldBookAIPatchForm.scope, (scope) => {
    if (scope !== 'paragraph') {
        worldBookAIPatchForm.paragraphIndex = 0;
    }
    if (scope !== 'field') {
        worldBookAIPatchForm.field = 'content';
    }
});

watch(
    () => [
        worldBookAIPatchForm.entryId,
        worldBookAIPatchForm.scope,
        worldBookAIPatchForm.mode,
        worldBookAIPatchForm.field,
        worldBookAIPatchForm.paragraphIndex,
        worldBookAIPatchForm.instruction,
        worldBookAIPatchForm.keepStyle,
        worldBookAIPatchForm.allowRelatedEntries,
    ],
    () => {
        if (worldBookAIPatchPlannerPreview.value || worldBookAIPatchPreview.value) {
            worldBookAIPatchForm.confirmReviewedDiff = false;
            clearWorldBookAIPatchPlannerPreview();
            clearWorldBookAIPatchPreview();
        }
    },
);

// 全局替换相关变量
const {
    showErrorModal,
    errorModal,
    openErrorModal,
    closeErrorModal,
    operationNotice,
    clearOperationNotice,
    showOperationNotice,
} = useOperationFeedback();

const {
    startTimeTracking,
    startBookTimeTracking,
    startAdvancedTimeTracking,
    stopTimeTracking,
    formattedCurrentTime,
    formattedStartTime,
    formattedBookStartTime,
    formattedAdvancedStartTime,
    translationDuration,
    bookTranslationDuration,
    advancedTranslationDuration,
} = useTranslationTiming();

const {
    snapshotMeta,
    canUndoSnapshot,
    canRestoreInitialSnapshot,
    pushSnapshot,
    resetSnapshots,
    saveManualSnapshot,
    undoLastSnapshot,
    restoreInitialSnapshot,
} = useSnapshotHistory({
    editableData,
    showOperationNotice,
});

const {
    initEditableData,
    createCharacterBook,
    addAlternateGreeting,
    removeAlternateGreeting,
    addBookEntry,
    removeBookEntry,
    updateEntryKeys,
    isV3Card,
    hasCharacterBook,
    getSpecVersion,
} = useCharacterEditor({
    characterData,
    editableData,
    pushSnapshot,
    resetSnapshots,
});

const {
    showGlobalReplaceModal,
    replaceForm,
    occurrenceCount,
    occurrenceDetails,
    checkOccurrences,
    executeGlobalReplace,
    closeGlobalReplaceModal,
} = useGlobalReplace({
    editableData,
    pushSnapshot,
    showOperationNotice,
});

const {
    isGenerating: isCharacterAICreating,
    generationStageLabel: characterAICreationStageLabel,
    draft: characterAICreateDraft,
    draftWarnings: characterAICreateWarnings,
    retryFailures: characterAICreateRetryFailures,
    generateDraft: generateCharacterAIDraft,
    retryFailedEntries: retryCharacterAIDraftFailedEntries,
    buildCharacterTemplateFromDraft,
    clearDraft: clearCharacterAIDraft,
} = useCharacterAICreation({
    apiSettings,
    openErrorModal,
    showOperationNotice,
});

const {
    isGenerating: isWorldBookAIGenerating,
    lastDraft: worldBookAIDraft,
    validationWarnings: worldBookAIWarnings,
    generateDraft: generateWorldBookAIDraft,
    applyDraftToEditableData,
} = useWorldBookAIGeneration({
    apiSettings,
    openErrorModal,
    showOperationNotice,
});

const {
    isPatching: isWorldBookAIPatching,
    plannerPreview: worldBookAIPatchPlannerPreview,
    patchPreview: worldBookAIPatchPreview,
    clearPlannerPreview: clearWorldBookAIPatchPlannerPreview,
    clearPatchPreview: clearWorldBookAIPatchPreview,
    generatePlannerPreview: generateWorldBookAIPatchPlannerPreview,
    generatePatchPreview: generateWorldBookAIPatchPreview,
    applyPatchPreviewToEditableData,
    getConfirmedPlanner: getConfirmedWorldBookAIPatchPlanner,
} = useWorldBookAIPatch({
    apiSettings,
    openErrorModal,
    showOperationNotice,
});

const {
    showErrorDetails,
} = useErrorDetails({
    openErrorModal,
});

const {
    showBatchTranslateModal,
    selectedFields,
    isTranslating,
    currentTranslatingField,
    translatedCount,
    totalFieldsToTranslate,
    translationErrors,
    isTranslationComplete,
    isTranslationError,
    canRetryTranslation,
    selectAllFields,
    deselectAllFields,
    startBatchTranslation,
    cancelTranslation,
    closeBatchTranslateModal,
} = useBasicTranslation({
    editableData,
    apiSettings,
    translationConfig,
    checkAndPromptApiConfig,
    startTimeTracking,
    stopTimeTracking,
    getPrepareTranslationCompare: () => prepareTranslationCompare,
    buildTranslationPrompt,
    getFriendlyErrorMessage,
    mapErrorCode,
    openErrorModal,
    showOperationNotice,
});

const {
    showCompareModal,
    translationCompareData,
    finalTranslationInfo,
    prepareTranslationCompare,
    prepareBookTranslationCompare,
    prepareAdvancedTranslationCompare,
    handleCompareApply,
    handleComparePreview,
    handleCompareClose,
} = useTranslationCompare({
    editableData,
    apiSettings,
    pushSnapshot,
    showOperationNotice,
    openErrorModal,
    stopTimeTracking,
    showBatchTranslateModal,
    showBookBatchTranslateModal,
    showAdvancedBatchTranslateModal,
    isTranslating,
    isTranslationComplete,
    isBookTranslating,
    isBookTranslationComplete,
    isAdvancedTranslating,
    isAdvancedTranslationComplete,
    formattedStartTime,
    translationDuration,
    formattedBookStartTime,
    bookTranslationDuration,
    formattedAdvancedStartTime,
    advancedTranslationDuration,
});

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

const displayImagePreview = computed(() => imagePreview.value || DEFAULT_COVER_IMAGE_DATA_URI);
const hasCustomCover = computed(() => !!(originalFileBytes.value && originalFileBytes.value.length > 0));

const {
    selectAllAlternateGreetings,
    deselectAllAlternateGreetings,
    startAdvancedBatchTranslation,
    cancelAdvancedTranslation,
    closeAdvancedBatchTranslateModal,
} = useAdvancedTranslationActions({
    editableData,
    advancedTranslateFields,
    selectedAlternateGreetings,
    hasAdvancedSelectedFields,
    apiSettings,
    translationConfig,
    buildTranslationPrompt,
    startAdvancedTimeTracking,
    stopTimeTracking,
    getPrepareAdvancedTranslationCompare: () => prepareAdvancedTranslationCompare,
    getFriendlyErrorMessage,
    mapErrorCode,
    openErrorModal,
    showOperationNotice,
    showAdvancedBatchTranslateModal,
    isAdvancedTranslating,
    advancedTranslatedCount,
    advancedTotalToTranslate,
    advancedTranslationErrors,
    isAdvancedTranslationComplete,
    cancelAdvancedTranslationFlag,
    advancedTranslationAbortController,
    isAdvancedTranslationError,
    canRetryAdvancedTranslation,
});

const tabs = [
    { id: 'basic', name: '基本信息' },
    { id: 'advanced', name: '高级设置' },
    { id: 'book', name: '世界书' },
    // { id: 'json', name: '原始JSON' }
];

const ALLOWED_COVER_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_COVER_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const clearImagePreviewObjectUrl = () => {
    if (imagePreviewObjectUrl.value) {
        URL.revokeObjectURL(imagePreviewObjectUrl.value);
        imagePreviewObjectUrl.value = '';
    }
};

const setImagePreviewFromBlob = (blob) => {
    clearImagePreviewObjectUrl();
    const url = URL.createObjectURL(blob);
    imagePreviewObjectUrl.value = url;
    imagePreview.value = url;
};

const convertImageFileToPngBytes = async (file) => {
    if (file.type === 'image/png') {
        return new Uint8Array(await file.arrayBuffer());
    }

    let imageSource = null;
    if (typeof createImageBitmap === 'function') {
        imageSource = await createImageBitmap(file);
    } else {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('读取封面文件失败。'));
            reader.readAsDataURL(file);
        });

        imageSource = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('加载封面图片失败。'));
            img.src = dataUrl;
        });
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('无法创建封面绘制上下文。');
    }

    ctx.drawImage(imageSource, 0, 0);

    if (typeof canvas.toBlob === 'function') {
        const pngBlob = await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('封面转换为 PNG 失败。'));
                    return;
                }
                resolve(blob);
            }, 'image/png');
        });

        return new Uint8Array(await pngBlob.arrayBuffer());
    }

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = String(dataUrl).split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const handleCoverUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        if (!ALLOWED_COVER_MIME_TYPES.includes(file.type)) {
            throw new Error('仅支持 PNG / JPG / WEBP 作为封面。');
        }

        if (file.size > MAX_COVER_FILE_SIZE) {
            throw new Error(`封面大小不能超过 ${Math.round(MAX_COVER_FILE_SIZE / 1024 / 1024)}MB。`);
        }

        const pngBytes = await convertImageFileToPngBytes(file);
        if (!pngBytes || pngBytes.length === 0) {
            throw new Error('封面转换结果为空。');
        }

        originalFileBytes.value = pngBytes;
        setImagePreviewFromBlob(new Blob([pngBytes], { type: 'image/png' }));

        showOperationNotice({
            type: 'success',
            title: '封面已更新',
            message: '导出时将使用当前封面作为角色卡图片。',
            duration: 4000,
        });
    } catch (error) {
        showOperationNotice({
            type: 'error',
            title: '封面更新失败（已保留原封面）',
            message: error.message,
            duration: 5500,
        });
    } finally {
        event.target.value = '';
    }
};

const clearCoverImage = () => {
    if (!hasCustomCover.value) {
        showOperationNotice({
            type: 'warning',
            title: '当前没有可移除的封面',
            message: '你还没有设置封面。',
            duration: 3000,
        });
        return;
    }

    originalFileBytes.value = null;
    clearImagePreviewObjectUrl();
    imagePreview.value = '';

    showOperationNotice({
        type: 'success',
        title: '封面已移除',
        message: '导出时会使用默认占位封面。',
        duration: 3500,
    });
};

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
    clearImagePreviewObjectUrl();
    imagePreview.value = '';
    isLoading.value = true;

    try {
        const isJsonFile = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');

        if (isJsonFile) {
            clearImagePreviewObjectUrl();
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

        const arrayBuffer = await file.arrayBuffer();
        originalFileBytes.value = new Uint8Array(arrayBuffer);
        setImagePreviewFromBlob(new Blob([originalFileBytes.value], { type: 'image/png' }));

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

const {
    exportCharacterCard,
} = useCharacterExport({
    characterData,
    editableData,
    originalFileBytes,
    getSpecVersion,
    showOperationNotice,
    CharacterCardUtils,
});

const handleSaveSettings = (settings) => {
    // This event is kept for now, but settings are managed by Pinia
    console.log('API settings saved via modal event:', settings);
};

const openCharacterAICreateModal = () => {
    clearCharacterAIDraft();
    showCharacterAICreateModal.value = true;
};

const closeCharacterAICreateModal = () => {
    showCharacterAICreateModal.value = false;
};

const handleGenerateCharacterAIDraft = async () => {
    if (!checkAndPromptApiConfig()) {
        return;
    }

    try {
        await generateCharacterAIDraft({
            ...characterAICreateForm,
            language: 'zh-CN',
        });
    } catch {
        // 错误已在 composable 统一处理
    }
};

const handleRetryCharacterAIFailedEntries = async ({ entryIds } = {}) => {
    if (!characterAICreateRetryFailures.value.length) {
        showOperationNotice({
            type: 'warning',
            title: '当前没有可重试条目',
            message: '请先生成草稿或检查失败列表。',
            duration: 3200,
        });
        return;
    }

    const selectedEntryIds = Array.isArray(entryIds)
        ? [...new Set(entryIds.map(v => String(v)).filter(Boolean))]
        : [];

    if (!selectedEntryIds.length) {
        showOperationNotice({
            type: 'warning',
            title: '请先选择要重试的条目',
            message: '至少勾选 1 条失败条目后再执行重试。',
            duration: 3200,
        });
        return;
    }

    try {
        await retryCharacterAIDraftFailedEntries({
            entryIds: selectedEntryIds,
        });
    } catch {
        // 错误已在 composable 统一处理
    }
};

const handleApplyCharacterAIDraft = () => {
    if (!characterAICreateDraft.value) {
        showOperationNotice({
            type: 'warning',
            title: '还没有可应用的角色草稿',
            message: '请先生成角色草稿。',
            duration: 3500,
        });
        return;
    }

    if (characterAICreateRetryFailures.value.length > 0) {
        showOperationNotice({
            type: 'warning',
            title: '仍有未补全条目',
            message: `请先完成失败条目重试（剩余 ${characterAICreateRetryFailures.value.length} 条）后再应用。`,
            duration: 4500,
        });
        return;
    }

    try {
        const { characterData: generatedCharacter, worldbookDraft } = buildCharacterTemplateFromDraft(characterAICreateDraft.value);

        characterData.value = generatedCharacter;
        fileName.value = `AI创建_${generatedCharacter.data?.name || '新角色'}.json`;
        originalFileBytes.value = null;
        clearImagePreviewObjectUrl();
        imagePreview.value = '';

        initEditableData();

        const applyResult = applyDraftToEditableData(editableData.value, worldbookDraft, {
            replaceExisting: true,
            applyOpeningsToGreetings: characterAICreateForm.applyOpeningsToGreetings,
        });

        activeTab.value = 'basic';
        selectedBookEntries.value = new Array(editableData.value.book_entries.length).fill(false);

        showOperationNotice({
            type: 'success',
            title: '已创建角色卡草稿',
            message: `角色 ${editableData.value.name || '未命名'} 已创建，世界书 ${applyResult.totalCount} 条。你现在可以继续编辑、上传封面后导出。`,
            duration: 5200,
        });

        closeCharacterAICreateModal();
    } catch (error) {
        openErrorModal({
            title: '应用角色草稿失败',
            code: 'AI_CHARACTER_APPLY_FAILED',
            message: error.message,
            details: { message: error.message },
        });
    }
};

const openWorldBookAIGenerateModal = () => {
    if (!editableData.value) {
        showOperationNotice({
            type: 'warning',
            title: '请先导入角色卡',
            message: '导入角色卡后才能生成世界书草稿。',
            duration: 4000,
        });
        return;
    }

    if (!hasCharacterBook()) {
        createCharacterBook();
    }

    if (!worldBookAIGenerateForm.premise && editableData.value?.scenario) {
        worldBookAIGenerateForm.premise = editableData.value.scenario;
    }

    showWorldBookAIGenerateModal.value = true;
};

const closeWorldBookAIGenerateModal = () => {
    showWorldBookAIGenerateModal.value = false;
};

const handleGenerateWorldBookAIDraft = async () => {
    if (!checkAndPromptApiConfig()) {
        return;
    }

    try {
        await generateWorldBookAIDraft({
            ...worldBookAIGenerateForm,
            language: 'zh-CN',
        });
    } catch {
        // 错误已经在 composable 内统一提示
    }
};

const handleApplyWorldBookAIDraft = () => {
    if (!worldBookAIDraft.value) {
        showOperationNotice({
            type: 'warning',
            title: '还没有可应用的草稿',
            message: '请先生成世界书草稿。',
            duration: 3500,
        });
        return;
    }

    try {
        pushSnapshot(worldBookAIGenerateForm.replaceExisting ? 'AI重写世界书' : 'AI追加世界书');

        const result = applyDraftToEditableData(editableData.value, worldBookAIDraft.value, {
            replaceExisting: worldBookAIGenerateForm.replaceExisting,
            applyOpeningsToGreetings: worldBookAIGenerateForm.applyOpeningsToGreetings,
        });

        selectedBookEntries.value = new Array(editableData.value.book_entries.length).fill(false);

        const openingTip = result.openingCount > 0
            ? `，同步 ${result.openingCount} 个开场分支`
            : '';
        const greetingTip = result.greetingsSyncedCount > 0
            ? `，更新了 ${result.greetingsSyncedCount} 条开场白`
            : '';

        showOperationNotice({
            type: 'success',
            title: worldBookAIGenerateForm.replaceExisting ? '已替换世界书条目' : '已追加世界书条目',
            message: `本次应用 ${result.addedCount} 条，当前总计 ${result.totalCount} 条${openingTip}${greetingTip}。`,
            duration: 5000,
        });

        closeWorldBookAIGenerateModal();
    } catch (error) {
        openErrorModal({
            title: '应用世界书草稿失败',
            code: 'AI_WORLD_BOOK_APPLY_FAILED',
            message: error.message,
            details: { message: error.message },
        });
    }
};

const openWorldBookAIPatchModal = () => {
    const entries = editableData.value?.book_entries || [];
    if (!entries.length) {
        showOperationNotice({
            type: 'warning',
            title: '当前没有可改写条目',
            message: '请先添加世界书条目，或先用 AI 代写生成功能创建条目。',
            duration: 4000,
        });
        return;
    }

    if (!worldBookAIPatchForm.entryId) {
        worldBookAIPatchForm.entryId = String(entries[0].id);
    }

    worldBookAIPatchForm.confirmReviewedDiff = false;
    clearWorldBookAIPatchPlannerPreview();
    clearWorldBookAIPatchPreview();
    showWorldBookAIPatchModal.value = true;
};

const closeWorldBookAIPatchModal = () => {
    showWorldBookAIPatchModal.value = false;
    worldBookAIPatchForm.confirmReviewedDiff = false;
    clearWorldBookAIPatchPlannerPreview();
    clearWorldBookAIPatchPreview();
};

const handleGenerateWorldBookAIPatchPlannerPreview = async () => {
    if (!checkAndPromptApiConfig()) {
        return;
    }

    try {
        worldBookAIPatchForm.confirmReviewedDiff = false;
        await generateWorldBookAIPatchPlannerPreview({
            editableData: editableData.value,
            patchForm: worldBookAIPatchForm,
        });
    } catch {
        // 错误已经在 composable 内统一提示
    }
};

const handleGenerateWorldBookAIPatchPreview = async () => {
    if (!checkAndPromptApiConfig()) {
        return;
    }

    try {
        worldBookAIPatchForm.confirmReviewedDiff = false;
        const confirmedPlanner = getConfirmedWorldBookAIPatchPlanner(
            worldBookAIPatchPlannerPreview.value,
            worldBookAIPatchForm.entryId,
        );
        await generateWorldBookAIPatchPreview({
            editableData: editableData.value,
            patchForm: worldBookAIPatchForm,
            confirmedPlanner,
        });
    } catch {
        // 错误已经在 composable 内统一提示
    }
};

const handleApplyWorldBookAIPatch = () => {
    if (!worldBookAIPatchPreview.value) {
        showOperationNotice({
            type: 'warning',
            title: '还没有可应用的改写预览',
            message: '请先生成改写预览。',
            duration: 3500,
        });
        return;
    }

    if (!worldBookAIPatchForm.confirmReviewedDiff) {
        showOperationNotice({
            type: 'warning',
            title: '请先确认差异',
            message: '勾选“我已核对差异并确认应用”后再应用改写。',
            duration: 3500,
        });
        return;
    }

    try {
        pushSnapshot('AI局部改写世界书');

        const result = applyPatchPreviewToEditableData(editableData.value, worldBookAIPatchPreview.value);

        showOperationNotice({
            type: result.changedCount > 0 ? 'success' : 'warning',
            title: result.changedCount > 0 ? '已应用 AI 局部改写' : '已应用改写（内容无变化）',
            message: `涉及 ${result.affectedEntryCount} 个条目，执行 ${result.operationCount} 个 patch 操作。`,
            duration: 4200,
        });

        closeWorldBookAIPatchModal();
        clearWorldBookAIPatchPreview();
    } catch (error) {
        openErrorModal({
            title: '应用局部改写失败',
            code: 'AI_WORLD_BOOK_PATCH_APPLY_FAILED',
            message: error.message,
            details: { message: error.message },
        });
    }
};

// 使用拆分后的通用辅助函数

onUnmounted(() => {
    clearImagePreviewObjectUrl();
});

// 初始化配置
onMounted(() => {
    // 加载API设置和翻译配置
    appStore.loadApiSettings();
    appStore.loadTranslationConfig();
});



const {
    selectAllBookEntries,
    deselectAllBookEntries,
    cancelBookTranslation,
    closeBookBatchTranslateModal,
    retryBookBatch,
    retryAllFailedBookBatches,
} = useWorldBookActions({
    editableData,
    selectedBookEntries,
    bookTranslateFields,
    bookBatchTranslateModalRef,
    bookBatchState,
    bookStreamTranslate,
    cancelBookStream,
    bookRequestAbortControllers,
    bookStreamResults,
    bookTranslationErrors,
    bookTranslationMissingTags,
    cancelBookTranslationFlag,
    showBookBatchTranslateModal,
    isBookTranslating,
    isBookTranslationComplete,
    isBookTranslationError,
    canRetryBookTranslation,
    apiSettings,
    translationConfig,
    checkAndPromptApiConfig,
    buildTranslationPrompt,
    buildBookTranslationTags,
    showOperationNotice,
    stopTimeTracking,
});

// 世界书批量翻译函数
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
    const selectedIndices = getSelectedBookIndices(selectedBookEntries.value);
    
    if (selectedIndices.length === 0) {
        showOperationNotice({
            type: 'warning',
            title: '请选择世界书条目',
            message: '至少选择一个条目后才能开始世界书翻译。',
        });
        isBookTranslating.value = false;
        return;
    }

    // 获取选中的字段
    const fieldsToTranslate = getBookFieldsToTranslate(bookTranslateFields);
    
    if (fieldsToTranslate.length === 0) {
        showOperationNotice({
            type: 'warning',
            title: '请选择翻译字段',
            message: '至少选择一个世界书字段后才能开始翻译。',
        });
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
        const totalItemsToTranslate = countBookTranslationItems({
            editableData: editableData.value,
            batches,
            fieldsToTranslate,
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
            console.log(`
🔄 开始翻译第 ${batchIndex + 1}/${totalBatches} 批，包含 ${batchIndices.length} 个条目`);
            bookBatchState.setBatchStatus(batchIndex, 'translating');

            const result = await executeWorldBookBatch({
                batchIndex,
                batchIndices,
                entries: editableData.value.book_entries,
                editableData: editableData.value,
                fieldsToTranslate,
                useStream,
                apiSettings: apiSettings.value,
                translationConfig: translationConfig.value,
                buildTranslationPrompt,
                buildBookTranslationTags,
                bookStreamTranslate,
                bookRequestAbortControllers,
                cancelBookTranslationFlag,
                onStreamProgress: (progressData) => {
                    console.log('流式进度更新:', progressData);
                    if (progressData.completed) {
                        bookTranslatedCount.value++;
                        bookStreamResults.value.push({
                            tag: progressData.tag,
                            result: progressData.result,
                            info: progressData.info,
                            batchIndex,
                            selected: true,
                        });
                    }
                },
            });

            if (result.status === 'cancelled') {
                console.log('翻译被取消');
                bookBatchState.setBatchStatus(batchIndex, 'error', { error: '用户取消' });
                return { cancelled: true };
            }

            if (result.status === 'skipped') {
                console.warn(`批次 ${batchIndex + 1} 没有可翻译内容，跳过`);
                bookBatchState.setBatchStatus(batchIndex, 'success', { results: {} });
                return { success: true, skipped: true };
            }

            if (result.status === 'error') {
                const errorMessage = result.error || `批次 ${batchIndex + 1} 翻译失败`;
                console.error(`❌ 批次 ${batchIndex + 1} 翻译失败:`, errorMessage);
                bookBatchState.setBatchStatus(batchIndex, 'error', { error: errorMessage });
                bookTranslationErrors.value.push({
                    field: `批次 ${batchIndex + 1}`,
                    message: errorMessage,
                });
                return { error: errorMessage };
            }

            const { batchResults, missingTags = [], expectedTags = [] } = result;
            if (!useStream) {
                console.log(`批次 ${batchIndex + 1} API返回结果:`, result.translatedText?.substring(0, 200));
                console.log('普通翻译 - 世界书翻译结果:', batchResults);
                console.log('普通翻译 - 丢失的标签:', missingTags);
            }

            bookTranslatedCount.value += result.translatedItemsCount || 0;

            if (!useStream && (Object.keys(batchResults).length === 0 || missingTags.length === expectedTags.length)) {
                const badFormatMsg = `批次 ${batchIndex + 1} 返回结果未遵循预期返回格式`;
                bookBatchState.setBatchStatus(batchIndex, 'error', { error: badFormatMsg });
                bookTranslationErrors.value.push({
                    field: `批次 ${batchIndex + 1}`,
                    message: badFormatMsg,
                });
                console.error(`❌ 批次 ${batchIndex + 1} 翻译失败`);
                return { error: badFormatMsg };
            }

            bookBatchState.setBatchStatus(batchIndex, 'success', { results: batchResults });
            console.log(`✅ 批次 ${batchIndex + 1} 翻译完成，成功 ${Object.keys(batchResults).length} 个条目`);

            if (missingTags.length > 0) {
                const missingItems = normalizeWorldBookMissingItems({ batchIndex, missingTags });
                bookTranslationMissingTags.value.push(...missingItems);
                missingItems.forEach(({ field, tag }) => {
                    bookTranslationErrors.value.push({
                        field,
                        message: `标签 ${tag} 在返回结果中丢失`,
                    });
                });
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
        const allResults = collectBookBatchResults(bookBatchState);
        
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
        } catch {
            // 非 JSON 错误，保持原始错误信息
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



// 重试单个失败的批次

// 重试所有失败的批次

</script>


