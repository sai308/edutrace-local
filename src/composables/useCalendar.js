import { ref, computed } from 'vue';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    format, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO
} from 'date-fns';
import { useI18n } from 'vue-i18n';

export function useCalendar(initialDate = new Date()) {
    const { t } = useI18n();
    const currentMonth = ref(initialDate);
    const weekDays = computed(() => [
        t('calendar.weekDays.sun'),
        t('calendar.weekDays.mon'),
        t('calendar.weekDays.tue'),
        t('calendar.weekDays.wed'),
        t('calendar.weekDays.thu'),
        t('calendar.weekDays.fri'),
        t('calendar.weekDays.sat')
    ]);

    function nextMonth() {
        currentMonth.value = addMonths(currentMonth.value, 1);
    }

    function prevMonth() {
        currentMonth.value = subMonths(currentMonth.value, 1);
    }

    function generateCalendarDays(sessionsMap, sessionDate = null) {
        const start = startOfWeek(startOfMonth(currentMonth.value));
        const end = endOfWeek(endOfMonth(currentMonth.value));

        return eachDayOfInterval({ start, end }).map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            let session = null;

            // Search for matching date in map keys
            // Assuming sessionsMap is a Map or Object where keys are date strings
            if (sessionsMap instanceof Map) {
                for (const [key, val] of sessionsMap.entries()) {
                    if (isSameDay(parseISO(key), date)) {
                        session = val;
                        break;
                    }
                }
            } else if (sessionsMap) {
                // Object fallback
                for (const [key, val] of Object.entries(sessionsMap)) {
                    if (isSameDay(parseISO(key), date)) {
                        session = val;
                        break;
                    }
                }
            }

            const isSessionDay = sessionDate && isSameDay(date, sessionDate);

            return {
                date,
                dateStr,
                isCurrentMonth: isSameMonth(date, currentMonth.value),
                isToday: isToday(date),
                session,
                isSessionDay
            };
        });
    }

    return {
        currentMonth,
        weekDays,
        nextMonth,
        prevMonth,
        generateCalendarDays
    };
}
