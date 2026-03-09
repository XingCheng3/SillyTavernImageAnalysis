import { computed, onBeforeUnmount, ref } from 'vue';

export function useTranslationTiming() {
    const translationStartTime = ref(null);
    const bookTranslationStartTime = ref(null);
    const advancedTranslationStartTime = ref(null);
    const currentTime = ref(new Date());
    let timeInterval = null;

    const ensureTicker = () => {
        currentTime.value = new Date();
        if (!timeInterval) {
            timeInterval = setInterval(() => {
                currentTime.value = new Date();
            }, 1000);
        }
    };

    const startTimeTracking = () => {
        translationStartTime.value = new Date();
        ensureTicker();
    };

    const startBookTimeTracking = () => {
        bookTranslationStartTime.value = new Date();
        ensureTicker();
    };

    const startAdvancedTimeTracking = () => {
        advancedTranslationStartTime.value = new Date();
        ensureTicker();
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

    const formatTime = (time) => {
        if (!time) return '';
        return time.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatDuration = (startTime) => {
        if (!startTime) return '';
        const duration = Math.floor((currentTime.value - startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formattedCurrentTime = computed(() => formatTime(currentTime.value));
    const formattedStartTime = computed(() => formatTime(translationStartTime.value));
    const formattedBookStartTime = computed(() => formatTime(bookTranslationStartTime.value));
    const formattedAdvancedStartTime = computed(() => formatTime(advancedTranslationStartTime.value));

    const translationDuration = computed(() => formatDuration(translationStartTime.value));
    const bookTranslationDuration = computed(() => formatDuration(bookTranslationStartTime.value));
    const advancedTranslationDuration = computed(() => formatDuration(advancedTranslationStartTime.value));

    onBeforeUnmount(() => {
        if (timeInterval) {
            clearInterval(timeInterval);
            timeInterval = null;
        }
    });

    return {
        translationStartTime,
        bookTranslationStartTime,
        advancedTranslationStartTime,
        currentTime,
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
    };
}
