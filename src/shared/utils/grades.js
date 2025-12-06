export function formatMarkToFiveScale(params) {
    let score, maxPoints;

    // Support both object {score, maxPoints} and arguments (score, maxPoints) signatures
    if (typeof params === 'object' && params !== null) {
        score = params.score;
        maxPoints = params.maxPoints;
    } else {
        score = arguments[0];
        maxPoints = arguments[1];
    }

    const max = Number(maxPoints) || 100;
    const percent = (Number(score) / max) * 100;

    if (percent >= 90) return 5;
    if (percent >= 75) return 4;
    if (percent >= 60) return 3;
    if (percent >= 35) return 2;
    return 1;
}
