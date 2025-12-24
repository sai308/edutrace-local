/**
 * Formats a percentage mark to a 5-scale system.
 * @param {number} percent 
 * @returns {number} 1-5
 */
export function to5Scale(percent) {
    if (percent >= 90) return 5;
    if (percent >= 75) return 4;
    if (percent >= 60) return 3;
    if (percent >= 35) return 2;
    return 1;
}

/**
 * Formats a percentage mark to ECTS (A-F).
 * @param {number} percent 
 * @returns {string} ECTS Letter
 */
export function toECTS(percent) {
    if (percent >= 90) return 'A';
    if (percent >= 82) return 'B';
    if (percent >= 75) return 'C';
    if (percent >= 67) return 'D';
    if (percent >= 60) return 'E';
    if (percent >= 35) return 'FX';
    return 'F';
}

/**
 * Formats a percentage mark to 100-scale (rounded).
 * @param {number} percent 
 * @returns {number}
 */
export function to100Scale(percent) {
    return Math.round(percent);
}

/**
 * Creates a formatter function based on the format name.
 * @param {string} format '5-scale' | 'ects' | '100-scale'
 * @returns {Function} (percent) => result
 */
export function createMarkFormatter(format) {
    return (percent) => {
        if (!format || format === '5-scale') return to5Scale(percent);
        if (format === 'ects') return toECTS(percent);
        if (format === '100-scale') return to100Scale(percent);
        return Math.round(percent);
    };
}

/**
 * Helper to convert a raw score with max points to 5-scale.
 * @param {number} score 
 * @param {number} maxPoints 
 * @returns {number}
 */
export function formatMarkToFiveScale(score, maxPoints) {
    const max = Number(maxPoints) || 100;
    const percent = (Number(score) / max) * 100;
    return to5Scale(percent);
}
