import { describe, it, expect } from 'vitest';
import { validateMarksFile, parseMarksCSV } from '~services/marksParser';

// Mock File class for testing
class MockFile {
    constructor(content, name) {
        this._content = content;
        this.name = name;
    }

    async text() {
        return this._content;
    }
}

describe('marksParser service', () => {

    // --- validateMarksFile Tests ---
    describe('validateMarksFile', () => {
        it('should validate a valid marks CSV with Ukrainian headers', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Завдання 1,Завдання 2
Дата,,,2024-11-01,2024-11-08
Бали,,,100,50
Іваненко,Іван,ivan@example.com,95,45`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await validateMarksFile(file);

            expect(result).toBe(true);
        });

        it('should validate a valid marks CSV with English headers', async () => {
            const csvContent = `Surname,First Name,Email,Task 1,Task 2
Date,,,2024-11-01,2024-11-08
Max Points,,,100,50
Smith,John,john@example.com,95,45`;

            const file = new MockFile(csvContent, 'Group1_Subject.csv');
            const result = await validateMarksFile(file);

            expect(result).toBe(true);
        });

        it('should validate with "Last Name" header variation', async () => {
            const csvContent = `Last Name,First Name,Email,Assignment 1
Date,,,2024-11-01
Points,,,100
Doe,Jane,jane@example.com,90`;

            const file = new MockFile(csvContent, 'test.csv');
            const result = await validateMarksFile(file);

            expect(result).toBe(true);
        });

        it('should throw error for insufficient lines', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса
Дата,,,2024-11-01`;

            const file = new MockFile(csvContent, 'invalid.csv');

            await expect(validateMarksFile(file)).rejects.toThrow('Invalid CSV format: Insufficient lines');
        });

        it('should throw error for Meet report (starts with *)', async () => {
            const csvContent = `* Meeting code: abc-defg-hij
* Created on Dec 1, 2024, 10:00:00 AM GMT+2
Full Name,Email,Duration
John Smith,john@example.com,00:45:00`;

            const file = new MockFile(csvContent, 'meet-report.csv');

            await expect(validateMarksFile(file)).rejects.toThrow(
                'Invalid Marks CSV: This looks like a Google Meet report. Please upload a Marks CSV.'
            );
        });

        it('should throw error for missing Surname/Прізвище column', async () => {
            const csvContent = `Name,Email,Task 1,Task 2
Date,,,2024-11-01,2024-11-08
Points,,,100,50
John Smith,john@example.com,95,45`;

            const file = new MockFile(csvContent, 'invalid.csv');

            await expect(validateMarksFile(file)).rejects.toThrow(
                'Invalid Marks CSV: Missing "Surname" or "Прізвище" column.'
            );
        });

        it('should handle empty file', async () => {
            const csvContent = '';
            const file = new MockFile(csvContent, 'empty.csv');

            await expect(validateMarksFile(file)).rejects.toThrow('Invalid CSV format: Insufficient lines');
        });

        it('should handle file with only whitespace', async () => {
            const csvContent = '   \n  \n  \n';
            const file = new MockFile(csvContent, 'whitespace.csv');

            await expect(validateMarksFile(file)).rejects.toThrow('Invalid CSV format: Insufficient lines');
        });
    });

    // --- parseMarksCSV Tests ---
    describe('parseMarksCSV', () => {
        it('should parse valid marks CSV with Ukrainian headers', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Завдання 1,Завдання 2
Дата,,,2024-11-01,2024-11-08
Бали,,,100,50
Іваненко,Іван,ivan@example.com,95,45
Петренко,Петро,petro@example.com,85,40`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.groupName).toBe('КН42');
            expect(result.tasks).toHaveLength(2);
            expect(result.tasks[0]).toEqual({
                name: 'Завдання 1',
                date: '2024-11-01',
                maxPoints: 100,
                groupName: 'КН42'
            });
            expect(result.tasks[1]).toEqual({
                name: 'Завдання 2',
                date: '2024-11-08',
                maxPoints: 50,
                groupName: 'КН42'
            });

            expect(result.studentsData).toHaveLength(2);
            expect(result.studentsData[0].student).toEqual({
                name: 'Іваненко Іван',
                email: 'ivan@example.com',
                groupName: 'КН42'
            });
            expect(result.studentsData[0].marks).toHaveLength(2);
            expect(result.studentsData[0].marks[0]).toEqual({
                taskIndex: 0,
                score: 95,
                synced: false
            });
        });

        it('should parse valid marks CSV with English headers', async () => {
            const csvContent = `Surname,First Name,Email,Task 1,Task 2
Date,,,2024-11-01,2024-11-08
Max Points,,,100,50
Smith,John,john@example.com,95,45`;

            const file = new MockFile(csvContent, 'Group1_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.groupName).toBe('Group1');
            expect(result.tasks).toHaveLength(2);
            expect(result.studentsData).toHaveLength(1);
            expect(result.studentsData[0].student.name).toBe('Smith John');
        });

        it('should extract group name from filename', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1
Дата,,,2024-11-01
Бали,,,100
Іваненко,Іван,ivan@example.com,95`;

            const file = new MockFile(csvContent, 'КН42_Розробка_застосувань_клієнтсерверної_архітектури.csv');
            const result = await parseMarksCSV(file);

            expect(result.groupName).toBe('КН42');
        });

        it('should use "Unknown Group" when filename has no underscore', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1
Дата,,,2024-11-01
Бали,,,100
Іваненко,Іван,ivan@example.com,95`;

            const file = new MockFile(csvContent, 'marks.csv');
            const result = await parseMarksCSV(file);

            expect(result.groupName).toBe('Unknown Group');
        });

        it('should handle students with empty marks', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1,Task 2,Task 3
Дата,,,2024-11-01,2024-11-08,2024-11-15
Бали,,,100,50,75
Іваненко,Іван,ivan@example.com,95,,60
Петренко,Петро,petro@example.com,,,`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.studentsData).toHaveLength(2);
            expect(result.studentsData[0].marks).toHaveLength(2); // Only tasks 1 and 3
            expect(result.studentsData[0].marks[0].taskIndex).toBe(0);
            expect(result.studentsData[0].marks[1].taskIndex).toBe(2);
            expect(result.studentsData[1].marks).toHaveLength(0); // No marks
        });

        it('should handle CSV with quoted fields containing commas', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,"Task 1, Part A","Task 2, Part B"
Дата,,,"01 лист. 2024 р.","08 лист. 2024 р."
Бали,,,100,50
"Іваненко-Петренко",Іван,ivan@example.com,95,45`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.tasks[0].name).toBe('Task 1, Part A');
            expect(result.tasks[1].name).toBe('Task 2, Part B');
            expect(result.studentsData[0].student.name).toBe('Іваненко-Петренко Іван');
        });

        it('should skip rows with insufficient columns', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1
Дата,,,2024-11-01
Бали,,,100
Іваненко,Іван,ivan@example.com,95
Incomplete,Row
,`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.studentsData).toHaveLength(1);
            expect(result.studentsData[0].student.name).toBe('Іваненко Іван');
        });

        it('should handle multiple tasks correctly', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,T1,T2,T3,T4,T5
Дата,,,2024-11-01,2024-11-08,2024-11-15,2024-11-22,2024-11-29
Бали,,,10,20,30,40,50
Іваненко,Іван,ivan@example.com,10,18,25,35,45`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.tasks).toHaveLength(5);
            expect(result.studentsData[0].marks).toHaveLength(5);
            expect(result.studentsData[0].marks[2].score).toBe(25);
            expect(result.studentsData[0].marks[2].taskIndex).toBe(2);
        });

        it('should handle real-world example CSV format', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,[ET] Додаткове завдання - Архітектура мікросервісів,[ET] Додаткове завдання - Розгортання клієнта,[L20] - P7 - Тестування серверних додатків. CI-CD,[L5] - P1 - Розгортання проекту в контейнері,[T1] Контрольна робота - Тести,[L11] - P2 - Дослідження REST API за допомогою HTTP клієнтів,[L12] - P3 - Розгортання Application Server на базі NodeJS та Fastify,[L14] - P4 - Інтеграція роботи з базами даних на прикладі PostgreSQL та MongoDB,[L16] - P5 - Побудова документованого CRUD для REST API з використанням шарової архітектури,[L18] - P6 - Впровадження механік аутентифікації та авторизації для API,[L23] - P8 - Масштабування серверних додатків
Дата,,,,,,29 вер. 2025 р.,15 жовт. 2025 р.,19 жовт. 2025 р.,23 жовт. 2025 р.,30 жовт. 2025 р.,6 лист. 2025 р.,13 лист. 2025 р.,1 груд. 2025 р.
Бали,,,5.0,5.0,5.0,5.0,100.0,5.0,5.0,5.0,5.0,5.0,5.0
Surname,Name Patronim,test@gmail.com,,,,5.0,96.0,3.0,0.0,0.0,,,`;

            const file = new MockFile(csvContent, 'КН42_CSA.csv');
            const result = await parseMarksCSV(file);

            expect(result.groupName).toBe('КН42');
            expect(result.tasks).toHaveLength(11);
            expect(result.tasks[0].name).toBe('[ET] Додаткове завдання - Архітектура мікросервісів');
            expect(result.tasks[3].maxPoints).toBe(5);
            expect(result.studentsData).toHaveLength(1);
            expect(result.studentsData[0].student.name).toBe('Surname Name Patronim');
            expect(result.studentsData[0].marks).toHaveLength(5); // Only non-empty marks
        });

        it('should throw error for insufficient lines', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса
Дата,,,2024-11-01`;

            const file = new MockFile(csvContent, 'invalid.csv');

            await expect(parseMarksCSV(file)).rejects.toThrow('Invalid CSV format: Insufficient lines');
        });

        it('should throw error for Meet report', async () => {
            const csvContent = `* Meeting code: abc-defg-hij
* Created on Dec 1, 2024, 10:00:00 AM GMT+2
Full Name,Email,Duration
John Smith,john@example.com,00:45:00`;

            const file = new MockFile(csvContent, 'meet-report.csv');

            await expect(parseMarksCSV(file)).rejects.toThrow(
                'Invalid Marks CSV: This looks like a Google Meet report. Please upload a Marks CSV.'
            );
        });

        it('should throw error for missing required column', async () => {
            const csvContent = `Name,Email,Task 1,Task 2
Date,,,2024-11-01,2024-11-08
Points,,,100,50
John Smith,john@example.com,95,45`;

            const file = new MockFile(csvContent, 'invalid.csv');

            await expect(parseMarksCSV(file)).rejects.toThrow(
                'Invalid Marks CSV: Missing "Surname" or "Прізвище" column.'
            );
        });

        it('should handle empty email field', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1
Дата,,,2024-11-01
Бали,,,100
Іваненко,Іван,,95`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.studentsData[0].student.email).toBe('');
        });

        it('should trim whitespace from names and emails', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1
Дата,,,2024-11-01
Бали,,,100
  Іваненко  ,  Іван  ,  ivan@example.com  ,95`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.studentsData[0].student.name).toBe('Іваненко Іван');
            expect(result.studentsData[0].student.email).toBe('ivan@example.com');
        });

        it('should set synced to false for all marks', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1,Task 2
Дата,,,2024-11-01,2024-11-08
Бали,,,100,50
Іваненко,Іван,ivan@example.com,95,45`;

            const file = new MockFile(csvContent, 'КН42_Subject.csv');
            const result = await parseMarksCSV(file);

            expect(result.studentsData[0].marks[0].synced).toBe(false);
            expect(result.studentsData[0].marks[1].synced).toBe(false);
        });
    });

    // --- parseCSVLine Helper Function Tests ---
    describe('parseCSVLine (implicit testing through parseMarksCSV)', () => {
        it('should parse simple comma-separated values', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1
Дата,,,2024-11-01
Бали,,,100
Іваненко,Іван,ivan@example.com,95`;

            const file = new MockFile(csvContent, 'test.csv');
            const result = await parseMarksCSV(file);

            expect(result.tasks[0].name).toBe('Task 1');
            expect(result.tasks[0].date).toBe('2024-11-01');
        });

        it('should handle quoted fields with commas', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,"Task 1, Part A"
Дата,,,"Nov 1, 2024"
Бали,,,100
"Smith, Jr.",John,john@example.com,95`;

            const file = new MockFile(csvContent, 'test.csv');
            const result = await parseMarksCSV(file);

            expect(result.tasks[0].name).toBe('Task 1, Part A');
            expect(result.tasks[0].date).toBe('Nov 1, 2024');
            expect(result.studentsData[0].student.name).toBe('Smith, Jr. John');
        });

        it('should handle empty fields', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,Task 1,Task 2
Дата,,,2024-11-01,
Бали,,,100,
Іваненко,Іван,,95,`;

            const file = new MockFile(csvContent, 'test.csv');
            const result = await parseMarksCSV(file);

            expect(result.tasks[1].date).toBe('');
            expect(result.tasks[1].maxPoints).toBe(0);
            expect(result.studentsData[0].student.email).toBe('');
        });

        it('should trim whitespace from fields', async () => {
            const csvContent = `Прізвище,Ім'я,Електронна адреса,  Task 1  
Дата,,,  2024-11-01  
Бали,,,  100  
  Іваненко  ,  Іван  ,  ivan@example.com  ,  95  `;

            const file = new MockFile(csvContent, 'test.csv');
            const result = await parseMarksCSV(file);

            expect(result.tasks[0].name).toBe('Task 1');
            expect(result.tasks[0].date).toBe('2024-11-01');
            expect(result.tasks[0].maxPoints).toBe(100);
        });

        it('should handle mixed quoted and unquoted fields', async () => {
            const csvContent = `Прізвище,"Ім'я",Електронна адреса,"Task 1"
Дата,,,2024-11-01
"Бали",,,100
Іваненко,"Іван",ivan@example.com,"95"`;

            const file = new MockFile(csvContent, 'test.csv');
            const result = await parseMarksCSV(file);

            expect(result.studentsData[0].student.name).toBe('Іваненко Іван');
            expect(result.studentsData[0].marks[0].score).toBe(95);
        });
    });
});
