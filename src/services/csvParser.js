import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

/**
 * Swaps "First Middle Last" to "Last First Middle"
 * Handles edge cases where there might be 2 or 4 parts, but generally assumes standard Ukrainian names.
 * @param {string} fullName 
 * @returns {string}
 */
export function processName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName; // Can't swap if only one name

    // Move the last part to the beginning
    const last = parts.pop();
    return [last, ...parts].join(' ');
}

/**
 * Parses a Google Meet attendance CSV file.
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

function parseTextContent(text, filename) {
    const lines = text.split('\n');
    let meetId = 'unknown-meet';
    let date = null;
    let startTime = null;
    let endTime = null;
    let csvStartIndex = 0;

    // Extract metadata from lines starting with *
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        // Remove surrounding quotes if present
        if (line.startsWith('"') && line.endsWith('"')) {
            line = line.slice(1, -1);
        }

        if (line.startsWith('*')) {
            if (line.includes('Meeting code:')) {
                meetId = line.split('Meeting code:')[1].trim();
            }
            if (line.includes('Created on')) {
                const dateStr = line.split('Created on')[1].trim();
                try {
                    const d = new Date(dateStr);
                    date = d.toISOString().split('T')[0];
                    startTime = d.toISOString();
                } catch (e) {
                    console.error('Failed to parse date from metadata', e);
                }
            }
            if (line.includes('Ended on')) {
                const dateStr = line.split('Ended on')[1].trim();
                try {
                    endTime = new Date(dateStr).toISOString();
                } catch (e) {
                    console.error('Failed to parse end date from metadata', e);
                }
            }
        } else if (line.includes('Full Name') || line.includes('Participant')) {
            csvStartIndex = i;
            break;
        }
    }

    // If no metadata found in file, try filename
    if (meetId === 'unknown-meet') {
        const meetIdMatch = filename.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
        if (meetIdMatch) meetId = meetIdMatch[0];
    }
    if (!date) {
        const dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) date = dateMatch[0];
        else date = new Date().toISOString().split('T')[0];
    }

    // Parse the CSV part
    const csvContent = lines.slice(csvStartIndex).join('\n');
    const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
    });

    const participants = [];
    const uniqueParticipants = {};

    parsed.data.forEach(row => {
        // Handle different header variations
        const nameKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('full name') ||
            k.toLowerCase().includes('participant') ||
            k.toLowerCase().includes('ім\'я')
        );

        const durationKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('time in call') ||
            k.toLowerCase().includes('duration') ||
            k.toLowerCase().includes('тривалість')
        );

        const emailKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('email') ||
            k.toLowerCase().includes('електронна пошта')
        );

        const joinTimeKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('first seen') ||
            k.toLowerCase().includes('join time') ||
            k.toLowerCase().includes('joined') ||
            k.toLowerCase().includes('час') ||
            k.toLowerCase().includes('приєднан')
        );

        if (nameKey && row[nameKey]) {
            const rawName = row[nameKey];
            const processedName = processName(rawName);
            const email = emailKey ? row[emailKey] : '';
            const durationStr = durationKey ? row[durationKey] : '0';
            const duration = parseDuration(durationStr);
            const joinTime = joinTimeKey ? row[joinTimeKey] : null;

            // Debug logging for first row
            if (!uniqueParticipants[processedName]) {
                console.log('CSV Parser - First participant:', {
                    name: processedName,
                    joinTimeKey,
                    joinTime,
                    availableKeys: Object.keys(row)
                });
            }

            const p = {
                id: uuidv4(),
                name: processedName,
                originalName: rawName,
                email: email,
                duration: duration,
                joinTime: joinTime
            };

            // Deduplicate by name (sum durations if multiple entries, keep earliest join time)
            if (!uniqueParticipants[p.name]) {
                uniqueParticipants[p.name] = { ...p };
            } else {
                uniqueParticipants[p.name].duration += p.duration;
                // Keep the earliest join time
                if (p.joinTime && (!uniqueParticipants[p.name].joinTime || p.joinTime < uniqueParticipants[p.name].joinTime)) {
                    uniqueParticipants[p.name].joinTime = p.joinTime;
                }
            }
        }
    });

    return {
        id: uuidv4(),
        meetId,
        date,
        startTime,
        endTime,
        filename,
        uploadedAt: new Date().toISOString(),
        participants: Object.values(uniqueParticipants)
    };
}

function parseDuration(str) {
    if (!str) return 0;
    let seconds = 0;

    // Handle "HH:MM:SS" or "MM:SS"
    if (str.includes(':')) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // Could be MM:SS or HH:MM? Usually MM:SS if short, but let's assume MM:SS for now unless context implies otherwise
            // But wait, "00:52:09" is HH:MM:SS. "00:25:13" is HH:MM:SS.
            // If only 2 parts, it's ambiguous. But standard duration format usually HH:MM:SS.
            // If "52:09", is it 52 mins or 52 hours?
            // Let's assume HH:MM:SS is standard. If 2 parts, treat as MM:SS?
            // The example shows "00:52:09", so it's 3 parts.
            seconds = parts[0] * 60 + parts[1];
        }
    } else {
        // Handle text format "1 hr 30 min"
        const hrMatch = str.match(/(\d+)\s*hr/);
        const minMatch = str.match(/(\d+)\s*min/);
        const secMatch = str.match(/(\d+)\s*s/);

        if (hrMatch) seconds += parseInt(hrMatch[1]) * 3600;
        if (minMatch) seconds += parseInt(minMatch[1]) * 60;
        if (secMatch) seconds += parseInt(secMatch[1]);
    }

    return seconds;
}
