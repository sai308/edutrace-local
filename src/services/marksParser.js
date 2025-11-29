import { repository } from './repository';

export async function validateMarksFile(file) {
    const text = await file.text();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    if (lines.length < 4) {
        throw new Error('Invalid CSV format: Insufficient lines');
    }

    // Validation: Check if it's a Meet report (starts with metadata *)
    if (lines[0].trim().startsWith('*')) {
        throw new Error('Invalid Marks CSV: This looks like a Google Meet report. Please upload a Marks CSV.');
    }

    // Validation: Check for required columns
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    const hasNameColumn = headers.some(h =>
        h.includes('Прізвище') ||
        h.toLowerCase().includes('surname') ||
        h.toLowerCase().includes('last name')
    );

    if (!hasNameColumn) {
        throw new Error('Invalid Marks CSV: Missing "Surname" or "Прізвище" column.');
    }

    return true;
}

export async function parseMarksCSV(file) {
    // Re-use validation (or just let it pass since we validate before calling this usually, 
    // but keeping it here is safe too, though slightly inefficient to read file twice if we don't pass content.
    // For now, let's just keep the logic here or call validate. 
    // Since we read text here anyway, calling validate which reads text again is inefficient.
    // Let's just duplicate the check or refactor to accept text.
    // Given the file size is small, reading twice is negligible.
    // But to be clean, let's just keep the checks here as they were, 
    // and `validateMarksFile` will be used by UI.

    const text = await file.text();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    if (lines.length < 4) {
        throw new Error('Invalid CSV format: Insufficient lines');
    }

    // Validation: Check if it's a Meet report (starts with metadata *)
    if (lines[0].trim().startsWith('*')) {
        throw new Error('Invalid Marks CSV: This looks like a Google Meet report. Please upload a Marks CSV.');
    }

    // Validation: Check for required columns
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    const hasNameColumn = headers.some(h =>
        h.includes('Прізвище') ||
        h.toLowerCase().includes('surname') ||
        h.toLowerCase().includes('last name')
    );

    if (!hasNameColumn) {
        throw new Error('Invalid Marks CSV: Missing "Surname" or "Прізвище" column.');
    }

    // Parse Group Name from filename
    // Format: GroupName_Subject.csv or similar. We need to extract "GroupName"
    // Example: КН42_Розробка_застосувань_клієнтсерверної_архітектури.csv -> КН42
    const filename = file.name;
    const groupNameMatch = filename.match(/^([^_]+)_/);
    const groupName = groupNameMatch ? groupNameMatch[1] : 'Unknown Group';

    // Parse Header (Line 1) - Task Names
    // Skip first 3 columns: Прізвище, Ім’я, Електронна адреса
    // headerLine and headers are already defined above for validation
    const taskNames = headers.slice(3);

    // Parse Dates (Line 2)
    const dateLine = lines[1];
    const dates = parseCSVLine(dateLine).slice(3);

    // Parse Max Points (Line 3)
    const maxPointsLine = lines[2];
    const maxPoints = parseCSVLine(maxPointsLine).slice(3);

    // Ensure we have consistent columns
    if (taskNames.length !== dates.length || taskNames.length !== maxPoints.length) {
        console.warn('Mismatch in header columns count');
    }

    // Process Tasks
    // We need to save tasks first to get their IDs
    // But we need a Group ID first. 
    // Wait, the requirement says "bind marks meta info to particular group".
    // We have a "groups" store, but it seems to be for "Meets" groups (linked to meetId).
    // Here we have a "Group Name" from filename.
    // Let's check if we should reuse the "groups" store or just use the string "groupName".
    // The `tasks` store I created has `groupId`.
    // Let's assume we need to find or create a Group entity.
    // However, the existing `groups` store has `meetId` as index.
    // Let's look at `repository.js` again. `groups` store has `id` and `meetId`.
    // Maybe I should just store `groupName` in `tasks` for now, or create a group if not exists.
    // For simplicity and robustness, let's store `groupName` directly in `tasks` or create a simple group mapping.
    // Actually, the requirement says "bind to particular Group".
    // Let's stick to using the string `groupName` for lookups for now, or create a group entry if we want to be formal.
    // Given the existing `groups` store is tied to `meetId`, it might be confusing to mix them.
    // But "Group" concept should be unified.
    // Let's just use the `groupName` string as the identifier for now in the `tasks` index `groupId` (which can be a string).

    const tasks = [];
    for (let i = 0; i < taskNames.length; i++) {
        tasks.push({
            name: taskNames[i],
            date: dates[i],
            maxPoints: maxPoints[i],
            groupName: groupName
        });
    }

    // Process Students and Marks
    const studentsData = [];

    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        const cols = parseCSVLine(line);

        if (cols.length < 3) continue;

        const lastName = cols[0];
        const firstName = cols[1];
        const email = cols[2];
        const fullName = `${lastName} ${firstName}`.trim();

        const student = {
            name: fullName,
            email: email,
            groupName: groupName
        };

        const marks = [];
        for (let j = 0; j < taskNames.length; j++) {
            const markValue = cols[3 + j];
            if (markValue) {
                marks.push({
                    taskIndex: j, // Temporary reference to task in `tasks` array
                    score: markValue,
                    synced: false // Default to false
                });
            }
        }

        studentsData.push({
            student,
            marks
        });
    }

    return {
        groupName,
        tasks,
        studentsData
    };
}

function parseCSVLine(line) {
    // Simple CSV parser handling quotes
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
