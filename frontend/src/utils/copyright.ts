/**
 * Returns a formatted copyright year string using industry best practice:
 *
 * - If the current year equals the founding year → "© 2025"
 * - If the current year is after the founding year → "© 2025–26" (short form)
 *
 * This auto-updates every year — no manual changes needed.
 *
 * @param foundingYear  The year the product was created (default: 2025)
 */
export function getCopyrightYears(foundingYear = 2025): string {
    const now = new Date().getFullYear();
    if (now <= foundingYear) {
        return `${foundingYear}`;
    }
    // Short-form two-digit suffix: "2025–26", "2025–27", etc.
    const suffix = String(now).slice(-2);
    return `${foundingYear}–${suffix}`;
}

