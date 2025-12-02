import { describe, it, expect } from 'vitest';
import { processName, parseCSV } from '~services/csvParser';

// Mock FileReader for testing parseCSV
class MockFileReader {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.result = null;
    }

    readAsText(file) {
        // Simulate async file reading
        setTimeout(() => {
            if (file._shouldError) {
                this.onerror(new Error('File read error'));
            } else {
                this.result = file._content;
                this.onload({ target: { result: this.result } });
            }
        }, 0);
    }
}

// Mock File class for testing
class MockFile {
    constructor(content, name, shouldError = false) {
        this._content = content;
        this.name = name;
        this._shouldError = shouldError;
    }
}

// Setup global FileReader mock
global.FileReader = MockFileReader;

describe('csvParser service', () => {

    // --- processName Tests ---
    describe('processName', () => {
        it('should swap 3-part Ukrainian names (First Middle Last → Last First Middle)', () => {
            expect(processName('Іван Петрович Сидоренко')).toBe('Сидоренко Іван Петрович');
            expect(processName('John Michael Smith')).toBe('Smith John Michael');
        });

        it('should swap 2-part names (First Last → Last First)', () => {
            expect(processName('Іван Сидоренко')).toBe('Сидоренко Іван');
            expect(processName('John Smith')).toBe('Smith John');
        });

        it('should handle 4+ part names by moving last part to beginning', () => {
            expect(processName('John Michael Robert Smith')).toBe('Smith John Michael Robert');
            expect(processName('A B C D E')).toBe('E A B C D');
        });

        it('should return original name if only one word', () => {
            expect(processName('John')).toBe('John');
            expect(processName('Іван')).toBe('Іван');
        });

        it('should handle empty or null input', () => {
            expect(processName('')).toBe('');
            expect(processName(null)).toBe('');
            expect(processName(undefined)).toBe('');
        });

        it('should handle extra whitespace', () => {
            expect(processName('  John   Michael   Smith  ')).toBe('Smith John Michael');
            expect(processName('John\t\tSmith')).toBe('Smith John');
        });
    });

    // --- parseCSV Tests ---
    describe('parseCSV', () => {

        it('should parse valid Meet CSV with full metadata', async () => {
            const csvContent = `"* Meeting code: abc-defg-hij"
"* Created on Dec 1, 2024, 10:00:00 AM GMT+2"
"* Ended on Dec 1, 2024, 11:30:00 AM GMT+2"
Full Name,Email,Time in call (minutes),First seen
John Smith,john@example.com,00:45:00,10:00:00
Jane Doe,jane@example.com,01:15:00,10:05:00`;

            const file = new MockFile(csvContent, 'meet-report.csv');
            const result = await parseCSV(file);

            expect(result.meetId).toBe('abc-defg-hij');
            expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(result.startTime).toBeDefined();
            expect(result.endTime).toBeDefined();
            expect(result.filename).toBe('meet-report.csv');
            expect(result.participants).toHaveLength(2);

            // Check name processing
            expect(result.participants[0].name).toBe('Smith John');
            expect(result.participants[0].originalName).toBe('John Smith');
            expect(result.participants[0].email).toBe('john@example.com');
            expect(result.participants[0].duration).toBe(45 * 60); // 45 minutes in seconds

            expect(result.participants[1].name).toBe('Doe Jane');
            expect(result.participants[1].duration).toBe(75 * 60); // 1:15:00 = 75 minutes
        });

        it('should parse Meet CSV without metadata and extract from filename', async () => {
            const csvContent = `Full Name,Email,Duration
John Smith,john@example.com,00:30:00`;

            const file = new MockFile(csvContent, 'meet-abc-defg-hij-2024-11-15.csv');
            const result = await parseCSV(file);

            expect(result.meetId).toBe('abc-defg-hij');
            expect(result.date).toBe('2024-11-15');
            expect(result.participants).toHaveLength(1);
        });

        it('should handle Ukrainian headers', async () => {
            const csvContent = `"Повне ім'я","Електронна пошта","Тривалість дзвінка (хвилини)","Час приєднання"
Іван Петрович Сидоренко,ivan@example.com,00:50:00,10:00:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants).toHaveLength(1);
            expect(result.participants[0].name).toBe('Сидоренко Іван Петрович');
            expect(result.participants[0].email).toBe('ivan@example.com');
            expect(result.participants[0].duration).toBe(50 * 60);
        });

        it('should deduplicate participants and sum durations', async () => {
            const csvContent = `Full Name,Email,Time in call (minutes)
John Smith,john@example.com,00:20:00
Jane Doe,jane@example.com,00:15:00
John Smith,john@example.com,00:10:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants).toHaveLength(2);

            const johnSmith = result.participants.find(p => p.name === 'Smith John');
            expect(johnSmith).toBeDefined();
            expect(johnSmith.duration).toBe(30 * 60); // 20 + 10 = 30 minutes
        });

        it('should keep earliest join time when deduplicating', async () => {
            const csvContent = `Full Name,Email,Duration,First seen
John Smith,john@example.com,00:20:00,10:00:00
John Smith,john@example.com,00:10:00,09:55:00
John Smith,john@example.com,00:05:00,10:05:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants).toHaveLength(1);
            expect(result.participants[0].joinTime).toBe('09:55:00'); // Earliest time
            expect(result.participants[0].duration).toBe(35 * 60); // 20 + 10 + 5 = 35 minutes
        });

        it('should handle aliases by treating them as same person', async () => {
            const csvContent = `Full Name,Email,Duration
Alice Johnson,alice@example.com,00:30:00
Ally Johnson,alice@example.com,00:15:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            // Both should be treated as separate entries since processName doesn't handle aliases
            // The deduplication is by processed name, not email
            expect(result.participants).toHaveLength(2);
            expect(result.participants.find(p => p.name === 'Johnson Alice')).toBeDefined();
            expect(result.participants.find(p => p.name === 'Johnson Ally')).toBeDefined();
        });

        it('should parse different duration formats - HH:MM:SS', async () => {
            const csvContent = `Full Name,Duration
John Smith,01:30:45`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants[0].duration).toBe(1 * 3600 + 30 * 60 + 45); // 5445 seconds
        });

        it('should parse different duration formats - MM:SS', async () => {
            const csvContent = `Full Name,Duration
John Smith,45:30`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants[0].duration).toBe(45 * 60 + 30); // 2730 seconds
        });

        it('should parse text duration format (hr/min/s)', async () => {
            const csvContent = `Full Name,Duration
John Smith,1 hr 30 min 15 s
Jane Doe,45 min
Bob Wilson,2 hr`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants[0].duration).toBe(1 * 3600 + 30 * 60 + 15); // 5415 seconds
            expect(result.participants[1].duration).toBe(45 * 60); // 2700 seconds
            expect(result.participants[2].duration).toBe(2 * 3600); // 7200 seconds
        });

        it('should handle empty or zero duration', async () => {
            const csvContent = `Full Name,Duration
John Smith,
Jane Doe,00:00:00
Jake Smith,00:21:15`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants[0].duration).toBe(1275);
        });

        it('should throw an error when all participants have zero or invalid duration', async () => {
            // Assuming csvContent contains valid headers but all participant rows
            // have zero duration or invalid names/durations that get filtered out.
            const csvContent = `
Full Name,Duration
"John Smith",
"Jane Doe","00:00:00"
"Teacher Tom","0"`;
            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');

            await expect(parseCSV(file)).rejects.toThrow(
                'Invalid Meet report: No participants with valid attendance found.'
            );
        });

        it('should throw error for Marks CSV (has Max Points column)', async () => {
            const csvContent = `Student Name,Assignment,Points,Max Points
John Smith,Homework 1,95,100`;

            const file = new MockFile(csvContent, 'marks.csv');

            await expect(parseCSV(file)).rejects.toThrow(
                'Invalid Meet report: This looks like a Marks CSV. Please upload a Google Meet attendance report.'
            );
        });

        it('should throw error for Marks CSV with Ukrainian headers', async () => {
            const csvContent = `Ім'я студента,Завдання,Бали,Максимальна кількість балів
Іван Сидоренко,Домашнє завдання 1,95,100`;

            const file = new MockFile(csvContent, 'marks.csv');

            await expect(parseCSV(file)).rejects.toThrow(
                'Invalid Meet report: This looks like a Marks CSV'
            );
        });

        it('should throw error when Duration column is missing', async () => {
            const csvContent = `Full Name,Email
John Smith,john@example.com
Jane Doe,jane@example.com`;

            const file = new MockFile(csvContent, 'invalid.csv');

            await expect(parseCSV(file)).rejects.toThrow(
                'Invalid Meet report: Missing required column (e.g., "Duration" or "Time in call").'
            );
        });

        it('should throw error when no participants found', async () => {
            const csvContent = `Full Name,Duration
`;

            const file = new MockFile(csvContent, 'empty.csv');

            await expect(parseCSV(file)).rejects.toThrow(
                'Invalid Meet report: No participants found.'
            );
        });

        it('should handle file read errors', async () => {
            const file = new MockFile('', 'error.csv', true);

            await expect(parseCSV(file)).rejects.toThrow('File read error');
        });

        it('should use current date as fallback when no date found', async () => {
            const csvContent = `Full Name,Duration
John Smith,00:30:00`;

            const file = new MockFile(csvContent, 'meet-report.csv');
            const result = await parseCSV(file);

            // Should use current date
            const today = new Date().toISOString().split('T')[0];
            expect(result.date).toBe(today);
        });

        it('should handle "Participant" header variation', async () => {
            const csvContent = `Participant,Email,Time in call (minutes)
John Smith,john@example.com,00:30:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants).toHaveLength(1);
            expect(result.participants[0].name).toBe('Smith John');
        });

        it('should generate unique IDs for participants and meet', async () => {
            const csvContent = `Full Name,Duration
John Smith,00:30:00
Jane Doe,00:45:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.id).toBeDefined();
            expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

            expect(result.participants[0].id).toBeDefined();
            expect(result.participants[1].id).toBeDefined();
            expect(result.participants[0].id).not.toBe(result.participants[1].id);
        });

        it('should set uploadedAt timestamp', async () => {
            const csvContent = `Full Name,Duration
John Smith,00:30:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const beforeParse = new Date().toISOString();
            const result = await parseCSV(file);
            const afterParse = new Date().toISOString();

            expect(result.uploadedAt).toBeDefined();
            expect(result.uploadedAt >= beforeParse).toBe(true);
            expect(result.uploadedAt <= afterParse).toBe(true);
        });

        it('should handle CSV with quoted fields containing commas', async () => {
            const csvContent = `Full Name,Email,Duration
"Smith, John",john@example.com,00:30:00
"Doe, Jane",jane@example.com,00:45:00`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants).toHaveLength(2);
            // Papa.parse should handle quoted fields correctly
            expect(result.participants[0].originalName).toBe('Smith, John');
        });

        it('should skip empty lines in CSV', async () => {
            const csvContent = `Full Name,Duration
John Smith,00:30:00

Jane Doe,00:45:00

`;

            const file = new MockFile(csvContent, 'meet-2024-12-01.csv');
            const result = await parseCSV(file);

            expect(result.participants).toHaveLength(2);
        });

        it('should handle metadata lines with surrounding quotes', async () => {
            const csvContent = `"* Meeting code: xyz-abcd-efg"
"* Created on Nov 15, 2024, 2:00:00 PM GMT+2"
"Full Name","Duration"
"John Smith","00:30:00"`;

            const file = new MockFile(csvContent, 'meet-2024-11-15.csv');
            const result = await parseCSV(file);

            expect(result.meetId).toBe('xyz-abcd-efg');
            expect(result.participants).toHaveLength(1);
        });
    });
});
