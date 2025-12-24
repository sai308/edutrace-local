import * as Comlink from 'comlink';
import ParserWorker from '@/workers/parser.worker?worker';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { groupsRepository } from '../../Groups/services/groups.repository';
import { studentsRepository } from '../../Students/services/students.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import { IdentityReconciler } from '@/shared/services/reconciliation/IdentityReconciler.js';
import { toast } from '@/services/toast';

export class ReportsService {
    constructor() {
        this.identityReconciler = new IdentityReconciler();
        this.worker = new ParserWorker();
        this.parser = Comlink.wrap(this.worker);
    }

    /**
     * Parse a single file.
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async parseFile(file) {
        const text = await file.text();
        return await this.parser.parseMeetReport(text, file.name);
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

            // Sync Students if group exists
            const group = groupsMap[result.meetId];
            if (group) {
                const rawStudents = result.participants.map(p => ({
                    name: p.name,
                    email: p.email || '',
                    groupName: group.name,
                    // Preserve original participant data index to map back Ids?
                    // IdentityReconciler returns array in same order.
                }));

                const reconciledStudents = await this.identityReconciler.resolveIdentities(rawStudents);

                // Add required fields for storage if new
                const studentsToSave = reconciledStudents.map(s => ({
                    ...s,
                    role: s.role || 'student'
                }));

                // Bulk save students
                await studentsRepository.bulkPut(studentsToSave);

                // Update participants with resolved IDs
                // Reconciled array corresponds to participants array by index.
                result.participants.forEach((p, index) => {
                    p.id = reconciledStudents[index].id;
                });
            }

            // Save Meet (now includes participant IDs if group found)
            await meetsRepository.saveMeet(result);
            stats.saved++;
        }

        return stats;
    }
}

export const reportsService = new ReportsService();
