export function useColors() {
    function getScoreColor(score) {
        if (score >= 90) return 'text-green-600 font-bold';
        if (score >= 75) return 'text-green-500';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-500';
    }

    return {
        getScoreColor
    };
}
