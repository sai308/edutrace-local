export function useMarkFormat() {
    function formatMarkToFiveScale(mark) {
        const max = Number(mark.maxPoints) || 100;
        const percent = (Number(mark.score) / max) * 100;

        if (percent >= 90) return 5;
        if (percent >= 75) return 4;
        if (percent >= 60) return 3;
        if (percent >= 35) return 2;
        return 1;
    }

    function formatMarkToECTS(mark) {
        const max = Number(mark.maxPoints) || 100;
        const percent = (Number(mark.score) / max) * 100;

        if (percent >= 90) return 'A';
        if (percent >= 82) return 'B';
        if (percent >= 75) return 'C';
        if (percent >= 67) return 'D';
        if (percent >= 60) return 'E';
        if (percent >= 35) return 'FX';

        return 'F';
    }

    function getFormattedMark(mark, format = 'raw') {
        if (format === 'raw') return mark.score;

        const max = Number(mark.maxPoints) || 100;
        const percent = (Number(mark.score) / max) * 100;

        if (format === '100-scale') {
            return Math.round(percent);
        }

        if (format === '5-scale') {
            return formatMarkToFiveScale(mark);
        }

        if (format === 'ects') {
            return formatMarkToECTS(mark);
        }

        return mark.score;
    }

    function getMarkTooltip(score, maxPoints) {
        const max = Number(maxPoints) || 100;
        const percent = (Number(score) / max) * 100;

        const scale100 = Math.round(percent);

        let scale5 = 0;
        let ects = 'F';

        if (percent >= 90) { scale5 = 5; ects = 'A'; }
        else if (percent >= 82) { scale5 = 4; ects = 'B'; }
        else if (percent >= 75) { scale5 = 4; ects = 'C'; }
        else if (percent >= 67) { scale5 = 3; ects = 'D'; }
        else if (percent >= 60) { scale5 = 3; ects = 'E'; }
        else if (percent >= 35) { scale5 = 2; ects = 'FX'; }
        else { scale5 = 1; ects = 'F'; }

        return [`5-scale: ${scale5}`, `100-scale: ${scale100}`, `ECTS: ${ects}`];
    }

    return {
        formatMarkToFiveScale,
        formatMarkToECTS,
        getFormattedMark,
        getMarkTooltip
    };
}
