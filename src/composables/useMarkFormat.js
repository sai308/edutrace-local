import { to5Scale, toECTS } from '../shared/utils/grades';

export function useMarkFormat() {
    function percentToFiveScale(percent) {
        return to5Scale(percent);
    }

    function percentToECTS(percent) {
        return toECTS(percent);
    }

    function formatMarkToFiveScale(mark) {
        const max = Number(mark.maxPoints) || 100;
        const percent = (Number(mark.score) / max) * 100;
        return percentToFiveScale(percent);
    }

    function formatMarkToECTS(mark) {
        const max = Number(mark.maxPoints) || 100;
        const percent = (Number(mark.score) / max) * 100;
        return percentToECTS(percent);
    }

    function getFormattedMark(mark, format = 'raw') {
        if (format === 'raw') return mark.score;

        const max = Number(mark.maxPoints) || 100;
        const percent = (Number(mark.score) / max) * 100;

        if (format === '100-scale') {
            return Math.round(percent);
        }

        if (format === '5-scale') {
            return percentToFiveScale(percent);
        }

        if (format === 'ects') {
            return percentToECTS(percent);
        }

        return mark.score;
    }

    function getMarkTooltip(score, maxPoints) {
        const max = Number(maxPoints) || 100;
        const percent = (Number(score) / max) * 100;

        const scale100 = Math.round(percent);
        const scale5 = percentToFiveScale(percent);
        const ects = percentToECTS(percent);

        return [`5-scale: ${scale5}`, `100-scale: ${scale100}`, `ECTS: ${ects}`];
    }

    return {
        formatMarkToFiveScale,
        formatMarkToECTS,
        getFormattedMark,
        getMarkTooltip,
        percentToFiveScale,
        percentToECTS
    };
}
