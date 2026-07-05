export const calculatePercent = (attended: number, total: number): number => {
    return total > 0 ? Math.round((attended / total) * 100 * 10) / 10 : 0;
};

export interface SemesterResult {
    status: 'safe' | 'danger' | 'neutral';
    statusMessage: string;
    percentage: number;
    safeSkips?: number;
    classesToAttend?: number;
}

export const calculateSemester = (
    attended: number,
    total: number,
    requiredPercent: number = 75
): SemesterResult => {
    const requiredPercentDecimal = requiredPercent / 100;

    if (total === 0) {
        return {
            status: 'neutral',
            statusMessage: 'No classes yet',
            percentage: 0,
        };
    }

    const currentPercent = attended / total;

    if (currentPercent >= requiredPercentDecimal) {
        const safeSkips =
            requiredPercentDecimal > 0
                ? Math.floor((attended - requiredPercentDecimal * total) / requiredPercentDecimal)
                : Infinity;

        return {
            status: 'safe',
            statusMessage: `You have ${safeSkips} safe skips`,
            percentage: Math.round(currentPercent * 100 * 10) / 10,
            safeSkips,
        };
    } else {
        const classesToAttend =
            1 - requiredPercentDecimal > 0
                ? Math.ceil(
                    (requiredPercentDecimal * total - attended) / (1 - requiredPercentDecimal)
                )
                : -1;

        return {
            status: 'danger',
            statusMessage:
                classesToAttend !== -1
                    ? `Attend the next ${classesToAttend} classes`
                    : 'Attend all upcoming classes',
            percentage: Math.round(currentPercent * 100 * 10) / 10,
            classesToAttend: classesToAttend !== -1 ? classesToAttend : undefined,
        };
    }
};

