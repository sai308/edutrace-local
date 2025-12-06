import { parseCSV } from './reportsParser.js';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { studentsRepository } from '../../Students/services/students.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import { toast } from '@/services/toast';

export class ReportsService {

    /**
     * Parse a single file.
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async parseFile(file) {
        return parseCSV(file);
    }

    /**
     * Process multiple files: parse, validate, save.
     * @param {Array<File>} files
     * @param {string} filterMode - 'all' or 'related'.
     * @returns {Promise<Object>} Stats { saved, skipped, unrecognized }
     */
    async processFiles(files, filterMode = 'all') {
        const stats = { saved: 0, skipped: 0, unrecognized: 0 };

        // Load dependencies in parallel
        const [groupsMap, limitMinutes] = await Promise.all([
            groupsRepository.getGroupMap(),
            settingsRepository.getDurationLimit()
        ]);

        const limitSeconds = limitMinutes > 0 ? limitMinutes * 60 : 0;

        // Parse all files first
        const parsePromises = files.map(f => this.parseFile(f));
        let results = [];
        try {
            results = await Promise.all(parsePromises);
        } catch (e) {
            console.error('Parsing error:', e);
            throw e; // Let caller handle parse errors
        }

        for (const result of results) {
            // Filter mode check
            if (filterMode === 'related') {
                const hasGroup = groupsMap[result.meetId];
                if (!hasGroup) {
                    console.warn(`Skipping file with unrecognized group ID: ${result.meetId}`);
                    stats.unrecognized++;
                    continue;
                }
            }

            // Duplicate check
            const isDup = await meetsRepository.isDuplicateFile(result.filename, result.meetId, result.date);
            if (isDup) {
                console.warn(`Skipping duplicate file: ${result.filename}`);
                stats.skipped++;
                continue;
            }

            // Apply duration limit
            if (limitSeconds > 0) {
                result.participants.forEach(p => {
                    if (p.duration > limitSeconds) {
                        p.duration = limitSeconds;
                    }
                });
            }

            // Save Meet
            await meetsRepository.saveMeet(result);
            stats.saved++;

            // Sync Students if group exists
            const group = groupsMap[result.meetId];
            if (group) {
                // We should batch this or let repo handle it?
                // For now, iterate as before, but maybe studentsRepository has a batch method?
                // saveMember handles one by one.
                // We can use syncParticipants from repo if we have it?
                // BaseRepo syncParticipants logic was slightly different (from list of meets).
                // Let's stick to simple loop for now to be safe.
                for (const p of result.participants) {
                    await studentsRepository.saveMember({
                        name: p.name,
                        groupName: group.name,
                        email: p.email || '',
                        role: 'student' // Default role
                    });
                }
            }
        }

        return stats;
    }
}

export const reportsService = new ReportsService();
