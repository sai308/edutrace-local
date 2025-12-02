import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

// --- Private Utility Helpers ---

/**
 * Keywords for dynamically finding column headers.
 * The keys are the standardized internal names.
 */
const COLUMN_KEYWORDS = {
    name: ['full name', 'participant', 'ім\'я'],
    duration: ['time in call', 'duration', 'тривалість'],
    email: ['email', 'електронна пошта'],
    joinTime: ['first seen', 'join time', 'joined', 'час', 'приєднан']
};

/**
 * Finds the correct case-insensitive key in an object based on a list of keywords.
 * @param {Object} obj - The object (e.g., a CSV row) to search in.
 * @param {Array<string>} keywords - The list of keywords to match against the keys.
 * @returns {string | undefined} The matching key, or undefined.
 */
function findKeyByKeywords(obj, keywords) {
    const keys = Object.keys(obj);
    if (keys.length === 0) return undefined;

    const lowerKeywords = keywords.map(k => k.toLowerCase());

    return keys.find(k => {
        const lowerKey = k.toLowerCase();
        return lowerKeywords.some(keyword => lowerKey.includes(keyword));
    });
}

/**
 * Extracts metadata (meetId, date, times, CSV start index) from the file lines.
 * @param {Array<string>} lines 
 * @param {string} filename 
 * @returns {{meetId: string, date: string, startTime: string, endTime: string, csvStartIndex: number}}
 */
function extractMetadata(lines, filename) {
    let meetId = 'unknown-meet';
    let date = null;
    let startTime = null;
    let endTime = null;
    let csvStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        // Remove surrounding quotes if present (for robust parsing)
        if (line.startsWith('"') && line.endsWith('"')) {
            line = line.slice(1, -1);
        }

        if (line.startsWith('*')) {
            // Use regex for robust key-value extraction
            const meetingCodeMatch = line.match(/Meeting code:\s*(.*)/);
            if (meetingCodeMatch) {
                meetId = meetingCodeMatch[1].trim();
            }

            const createdOnMatch = line.match(/Created on\s*(.*)/);
            if (createdOnMatch) {
                try {
                    const d = new Date(createdOnMatch[1].trim());
                    date = d.toISOString().split('T')[0];
                    startTime = d.toISOString();
                } catch (e) {
                    console.error('Failed to parse creation date from metadata', createdOnMatch[1], e);
                }
            }

            const endedOnMatch = line.match(/Ended on\s*(.*)/);
            if (endedOnMatch) {
                try {
                    endTime = new Date(endedOnMatch[1].trim()).toISOString();
                } catch (e) {
                    console.error('Failed to parse end date from metadata', endedOnMatch[1], e);
                }
            }
        } else if (line.includes('Full Name') || line.includes('Participant') || line.includes('ім\'я')) {
            // Found the header row
            csvStartIndex = i;
            break;
        }
    }

    // Fallbacks from filename
    if (meetId === 'unknown-meet') {
        const meetIdMatch = filename.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
        if (meetIdMatch) meetId = meetIdMatch[0];
    }
    if (!date) {
        const dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/);
        date = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];
    }

    return { meetId, date, startTime, endTime, csvStartIndex };
}


/**
 * Parses duration string (HH:MM:SS, MM:SS, or "X hr Y min").
 * @param {string} str 
 * @returns {number} Duration in seconds.
 */
function parseDuration(str) {
    if (!str) return 0;
    str = str.trim();
    let seconds = 0;

    // 1. Handle HH:MM:SS or MM:SS format
    if (str.includes(':')) {
        const parts = str.split(':').map(p => parseInt(p, 10));

        if (parts.some(isNaN)) return 0;

        if (parts.length === 3) { // HH:MM:SS
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) { // MM:SS (most common two-part interpretation)
            seconds = parts[0] * 60 + parts[1];
        }
    } else {
        // 2. Handle Text format (e.g., "1 hr 30 min 5 s")
        const hrMatch = str.match(/(\d+)\s*hr/i);
        const minMatch = str.match(/(\d+)\s*min/i);
        const secMatch = str.match(/(\d+)\s*s/i);

        if (hrMatch) seconds += parseInt(hrMatch[1], 10) * 3600;
        if (minMatch) seconds += parseInt(minMatch[1], 10) * 60;
        if (secMatch) seconds += parseInt(secMatch[1], 10);
    }

    return seconds;
}


// --- Exported Contracts ---

/**
 * Swaps "First Middle Last" to "Last First Middle" (e.g., Ivan Ivanovich Ivanov -> Ivanov Ivan Ivanovich)
 * @param {string} fullName 
 * @returns {string}
 */
export function processName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length < 2) return fullName;

    // Move the last part (Surname) to the beginning
    const last = parts.pop();
    return [last, ...parts].join(' ');
}

/**
 * Parses a Google Meet attendance CSV file.
 * Contract preserved: Accepts File, returns Promise<Object>.
 * @param {File} file 
 * @returns {Promise<Object>} Parsed data
 */
export function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            try {
                const data = parseTextContent(text, file.name);
                resolve(data);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Core parsing logic, extracted and optimized.
 * @param {string} text - The raw CSV content.
 * @param {string} filename - The original filename for fallbacks.
 * @returns {Object} The processed report object.
 */
function parseTextContent(text, filename) {
    const lines = text.split('\n');
    const { meetId, date, startTime, endTime, csvStartIndex } = extractMetadata(lines, filename);

    const csvContent = lines.slice(csvStartIndex).join('\n');
    const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
    });

    if (parsed.data.length === 0) {
        throw new Error('Invalid Meet report: No participants found.');
    }

    const firstRow = parsed.data[0];

    // --- Validation and Header Mapping ---

    const durationKey = findKeyByKeywords(firstRow, COLUMN_KEYWORDS.duration);
    const nameKey = findKeyByKeywords(firstRow, COLUMN_KEYWORDS.name);
    const emailKey = findKeyByKeywords(firstRow, COLUMN_KEYWORDS.email);
    const joinTimeKey = findKeyByKeywords(firstRow, COLUMN_KEYWORDS.joinTime);

    if (!durationKey) {
        // Check for Marks CSV for better error message
        const hasMaxPoints = lines.some(l => l.includes('Max Points') || l.includes('Максимальна кількість балів'));
        if (hasMaxPoints) {
            throw new Error('Invalid Meet report: This looks like a Marks CSV. Please upload a Google Meet attendance report.');
        }
        throw new Error('Invalid Meet report: Missing required column (e.g., "Duration" or "Time in call").');
    }

    if (!nameKey) {
        throw new Error('Invalid Meet report: Missing required column (e.g., "Full Name" or "Participant").');
    }

    // --- Participant Processing and Deduplication ---

    const uniqueParticipants = new Map();

    parsed.data.forEach(row => {
        const rawName = row[nameKey];

        if (!rawName) return;

        const processedName = processName(rawName);
        const duration = parseDuration(row[durationKey]);

        if (duration === 0) return; // Optimization: skip participants with 0 duration

        const p = {
            id: uuidv4(),
            name: processedName,
            originalName: rawName,
            email: emailKey ? row[emailKey] : '',
            duration: duration,
            joinTime: joinTimeKey ? row[joinTimeKey] : null
        };

        // Deduplicate by processed name (sum durations, keep earliest join time)
        if (!uniqueParticipants.has(p.name)) {
            uniqueParticipants.set(p.name, p);
        } else {
            const existing = uniqueParticipants.get(p.name);
            existing.duration += p.duration;

            // Keep the earliest join time (only compare if both are present)
            if (p.joinTime && (!existing.joinTime || p.joinTime < existing.joinTime)) {
                existing.joinTime = p.joinTime;
            }
        }
    });

    if (uniqueParticipants.size === 0) {
        throw new Error('Invalid Meet report: No participants with valid attendance found.');
    }

    return {
        id: uuidv4(),
        meetId,
        date,
        startTime,
        endTime,
        filename,
        uploadedAt: new Date().toISOString(),
        participants: Array.from(uniqueParticipants.values())
    };
}