import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportsService } from '../reports.service';
import { meetsRepository } from '../../../Analytics/services/meets.repository';
import { groupsRepository } from '../../../Groups/services/groups.repository';
import { studentsRepository } from '../../../Students/services/students.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
import * as parser from '../reportsParser.js';

vi.mock('../../../Analytics/services/meets.repository');
vi.mock('../../../Groups/services/groups.repository');
vi.mock('../../../Students/services/students.repository');
vi.mock('@/shared/services/settings.repository');
vi.mock('../reportsParser.js');
// The parser is not a class, so we can mock its exports.

describe('ReportsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Polyfill File if needed
        if (typeof File === 'undefined') {
            global.File = class File {
                constructor(parts, filename, options) {
                    this.parts = parts;
                    this.name = filename;
                    this.options = options;
                }
            };
        }
    });

    it('should process files correctly', async () => {
        // Mock data
        const files = [new File(['content'], 'test.csv')];
        const parsedData = {
            meetId: 'm1',
            filename: 'test.csv',
            date: '2023-01-01',
            participants: [{ name: 'S1', duration: 100 }]
        };
        const groupsMap = { 'm1': { name: 'G1' } };

        // Mock impls
        vi.spyOn(parser, 'parseCSV').mockResolvedValue(parsedData);
        groupsRepository.getGroupMap.mockResolvedValue(groupsMap);
        settingsRepository.getDurationLimit.mockResolvedValue(0);
        meetsRepository.isDuplicateFile.mockResolvedValue(false);

        // Execute
        const result = await reportsService.processFiles(files);

        // Verify
        expect(result.saved).toBe(1);
        expect(meetsRepository.saveMeet).toHaveBeenCalledWith(parsedData);
        expect(studentsRepository.saveMember).toHaveBeenCalledWith({
            name: 'S1',
            groupName: 'G1',
            email: '',
            role: 'student'
        });
    });

    it('should skip duplicates', async () => {
        const files = [new File([''], 'dup.csv')];
        const parsedData = { meetId: 'm1', filename: 'dup.csv', date: '2023-01-01', participants: [] };

        vi.spyOn(parser, 'parseCSV').mockResolvedValue(parsedData);
        groupsRepository.getGroupMap.mockResolvedValue({});
        settingsRepository.getDurationLimit.mockResolvedValue(0);
        meetsRepository.isDuplicateFile.mockResolvedValue(true);

        const result = await reportsService.processFiles(files);

        expect(result.skipped).toBe(1);
        expect(meetsRepository.saveMeet).not.toHaveBeenCalled();
    });
});
