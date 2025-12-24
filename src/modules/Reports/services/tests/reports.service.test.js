import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportsService } from '../reports.service';
import { meetsRepository } from '../../../Analytics/services/meets.repository';
import { groupsRepository } from '../../../Groups/services/groups.repository';
import { studentsRepository } from '../../../Students/services/students.repository';
import { settingsRepository } from '@/shared/services/settings.repository';
// Mock Worker import
vi.mock('@/workers/parser.worker?worker', () => ({
    default: class {
        constructor() {
            this.postMessage = vi.fn();
            this.terminate = vi.fn();
        }
    }
}));

const { mockParseMeetReport } = vi.hoisted(() => ({
    mockParseMeetReport: vi.fn()
}));

// Mock Comlink
vi.mock('comlink', () => ({
    wrap: vi.fn().mockReturnValue({
        parseMeetReport: mockParseMeetReport
    }),
    expose: vi.fn()
}));

// Mock repositories
vi.mock('../../../Analytics/services/meets.repository');
vi.mock('../../../Groups/services/groups.repository');
vi.mock('../../../Students/services/students.repository');
vi.mock('@/shared/services/settings.repository');

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
                text() {
                    return Promise.resolve(this.parts[0] || '');
                }
            };
        }
    });

    it('should process files correctly', async () => {
        // Mock data
        const mockFile = {
            name: 'test.csv',
            text: vi.fn().mockResolvedValue('content')
        };
        const files = [mockFile];
        const parsedData = {
            meetId: 'm1',
            filename: 'test.csv',
            date: '2023-01-01',
            participants: [{ name: 'S1', duration: 100 }]
        };
        const groupsMap = { 'm1': { name: 'G1' } };

        // Mock impls
        mockParseMeetReport.mockResolvedValue(parsedData);
        groupsRepository.getGroupMap.mockResolvedValue(groupsMap);
        settingsRepository.getDurationLimit.mockResolvedValue(0);
        meetsRepository.isDuplicateFile.mockResolvedValue(false);
        studentsRepository.getAllMembers.mockResolvedValue([]); // For reconciler
        studentsRepository.bulkPut.mockResolvedValue();
        meetsRepository.saveMeet.mockResolvedValue();

        // Execute
        const result = await reportsService.processFiles(files);

        // Verify
        expect(result.saved).toBe(1);
        expect(meetsRepository.saveMeet).toHaveBeenCalledWith(parsedData);
    });

    it('should skip duplicates', async () => {
        const mockFile = {
            name: 'dup.csv',
            text: vi.fn().mockResolvedValue('')
        };
        const files = [mockFile];
        const parsedData = { meetId: 'm1', filename: 'dup.csv', date: '2023-01-01', participants: [] };

        mockParseMeetReport.mockResolvedValue(parsedData);
        groupsRepository.getGroupMap.mockResolvedValue({});
        settingsRepository.getDurationLimit.mockResolvedValue(0);
        meetsRepository.isDuplicateFile.mockResolvedValue(true);
        studentsRepository.getAllMembers.mockResolvedValue([]); // For reconciler

        const result = await reportsService.processFiles(files);

        expect(result.skipped).toBe(1);
        expect(meetsRepository.saveMeet).not.toHaveBeenCalled();
    });
});
