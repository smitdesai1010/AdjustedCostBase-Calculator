
import { parseLocalDate, formatLocalDate } from '../utils/date.utils.js';

console.log('--- Testing parseLocalDate ---');

const testDate = '2023-01-01';
console.log(`Input: ${testDate}`);
const parsed = parseLocalDate(testDate);
console.log(`Parsed Date Object: ${parsed.toString()}`);
console.log(`Year: ${parsed.getFullYear()} (Expected: 2023)`);
console.log(`Month: ${parsed.getMonth() + 1} (Expected: 1)`);
console.log(`Date: ${parsed.getDate()} (Expected: 1)`);
console.log(`Hours: ${parsed.getHours()} (Expected: 0)`);

if (parsed.getFullYear() === 2023 && parsed.getMonth() === 0 && parsed.getDate() === 1 && parsed.getHours() === 0) {
    console.log('✅ PASS: Date parsed correctly locally.');
} else {
    console.error('❌ FAIL: Date parsing incorrect.');
}


console.log('\n--- Testing formatLocalDate ---');
const formatted = formatLocalDate(parsed);
console.log(`Original Input: ${testDate}`);
console.log(`Formatted Output: ${formatted}`);

if (formatted === testDate) {
    console.log('✅ PASS: Date formatted correctly.');
} else {
    console.error('❌ FAIL: Date formatting incorrect.');
}
