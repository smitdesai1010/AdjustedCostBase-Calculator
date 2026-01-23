/**
 * Parses a date string (YYYY-MM-DD) into a Date object representing
 * midnight at the start of that day in the local time zone.
 *
 * This avoids the default behavior of `new Date('YYYY-MM-DD')` which
 * interprets the string as UTC midnight, typically resulting in the
 * previous day when converted to local time in the Western Hemisphere.
 *
 * @param dateString - The date string in YYYY-MM-DD format
 * @returns A Date object set to local midnight of the given date
 * @throws Error if the format is invalid
 */
export function parseLocalDate(dateString: string): Date {
    // Basic validation for YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        // Fallback for full ISO strings if they are passed by mistake,
        // although the intent is strict YYYY-MM-DD handling.
        // If it's not YYYY-MM-DD, try standard parsing but warn or handle as needed.
        // For this strict requirement, we'll try to extract the date part if it's an ISO string.
        if (dateString.includes('T')) {
            const datePart = dateString.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                return parseLocalDate(datePart);
            }
        }
        throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    }

    const [year, month, day] = dateString.split('-').map(Number);

    // Note: Month is 0-indexed in JavaScript Date
    return new Date(year, month - 1, day);
}

/**
 * Formats a Date object to a YYYY-MM-DD string using local time components.
 */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
