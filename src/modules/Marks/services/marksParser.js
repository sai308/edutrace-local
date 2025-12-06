import Papa from 'papaparse';

// --- Private Constants & Helpers (unchanged) ---

const REQUIRED_HEADERS = [
    'Прізвище',
    'surname',
    'last name'
];

function findHeaderByKeywords(headers, keywords) {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    return headers.find(h => {
        const lowerHeader = h.toLowerCase();
        return lowerKeywords.some(keyword => lowerHeader.includes(keyword));
    });
}

async function readFileLines(file) {
    const text = await file.text();
    return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

function parseSingleCSVLine(line) {
    const parsed = Papa.parse(line, {
        header: false,
        skipEmptyLines: true,
        delimiter: ','
    });
    return parsed.data[0] || [];
}

// --- Exported Contracts ---

/**
 * Validates the Marks CSV file structure before full parsing.
 * Contract preserved: Accepts File, returns Promise<boolean> or throws error.
 * @param {File} file
 * @returns {Promise<boolean>}
 */
export async function validateMarksFile(file) {
    const lines = await readFileLines(file);

    if (lines.length < 4) {
        throw new Error('Invalid CSV format: Insufficient lines (Expected at least 4 for headers/data).');
    }

    // Validation 1: Check if it's a Meet report (starts with metadata *)
    if (lines[0].startsWith('*')) {
        throw new Error('Invalid Marks CSV: This looks like a Google Meet report. Please upload a Marks CSV.');
    }

    // Validation 2: Check for required columns (Surname/Прізвище)
    const headerLine = lines[0];
    const headers = parseSingleCSVLine(headerLine);

    const hasNameColumn = findHeaderByKeywords(headers, REQUIRED_HEADERS);

    if (!hasNameColumn) {
        throw new Error('Invalid Marks CSV: Missing "Surname" or "Прізвище" column.');
    }

    return true;
}

/**
 * Parses the validated multi-header Marks CSV file.
 * Contract preserved: Accepts File, returns Promise<Object>.
 * @param {File} file
 * @returns {Promise<Object>} Parsed structure containing groupName, tasks, and studentsData.
 */
export async function parseMarksCSV(file) {
    const lines = await readFileLines(file);

    // --- CRITICAL VALIDATION REORDERING ---

    // 1. Basic length and type checks (matching validateMarksFile order)
    if (lines.length < 4) {
        throw new Error('Invalid CSV format: Insufficient lines (Expected at least 4 for headers/data).');
    }
    if (lines[0].startsWith('*')) {
        throw new Error('Invalid Marks CSV: This looks like a Google Meet report. Please upload a Marks CSV.');
    }

    // 2. Parse Line 1: Task Names (Header)
    const headerLine = lines[0];
    const headers = parseSingleCSVLine(headerLine);

    // 3. Check for required Name Column (THE MISSING CHECK)
    const hasNameColumn = findHeaderByKeywords(headers, REQUIRED_HEADERS);
    if (!hasNameColumn) {
        // THIS MUST BE THROWN BEFORE WE SLICE/COMPARE ARRAYS
        throw new Error('Invalid Marks CSV: Missing "Surname" or "Прізвище" column.');
    }

    // 4. Parse Lines 2 & 3
    const dateLine = lines[1];
    const dates = parseSingleCSVLine(dateLine);

    const maxPointsLine = lines[2];
    const rawMaxPoints = parseSingleCSVLine(maxPointsLine);

    // --- Continue Processing (Optimized) ---

    // 5. Extract Group Name from filename
    const filename = file.name;
    const groupNameMatch = filename.match(/^([^_]+)_/);
    const groupName = groupNameMatch ? groupNameMatch[1] : 'Unknown Group';

    // 6. Extract Task Metadata (Slice off first 3 columns: LastName, FirstName, Email)
    const taskNames = headers.slice(3);
    const taskDates = dates.slice(3);
    // Ensure rawMaxPoints is long enough before slicing
    const taskMaxPoints = rawMaxPoints.slice(3).map(p => parseInt(p.replace(/[^\d.]/g, '') || '0', 10));

    // 7. Check Task Metadata Consistency (This is now the next validation step)
    if (taskNames.length === 0 || taskNames.length !== taskDates.length || taskNames.length !== taskMaxPoints.length) {
        throw new Error('Invalid Marks CSV: Mismatch or absence of task header rows (Task Name, Date, Max Points).');
    }

    const tasks = taskNames.map((name, index) => ({
        name: name.trim(),
        date: taskDates[index].trim(),
        maxPoints: taskMaxPoints[index],
        groupName: groupName
    }));

    // --- 8. Process Student Marks (Lines 4+) ---
    const studentsData = [];

    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        const cols = parseSingleCSVLine(line);

        if (cols.length < 3) continue;

        const lastName = (cols[0] || '').trim();
        const firstName = (cols[1] || '').trim();
        const email = (cols[2] || '').trim();
        const fullName = `${lastName} ${firstName}`.trim();

        if (!fullName) continue;

        const student = {
            name: fullName,
            email: email,
            groupName: groupName
        };

        const marks = [];
        const scoreStartIndex = 3;

        for (let j = 0; j < taskNames.length; j++) {
            const markValue = cols[scoreStartIndex + j];
            if (markValue && markValue.trim().length > 0) {
                const score = parseFloat(markValue.trim());

                if (!isNaN(score)) {
                    marks.push({
                        taskIndex: j,
                        score: score,
                        synced: false
                    });
                }
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