import { vi, describe, it, expect, beforeEach } from 'vitest';
import { analytics } from '~services/analytics'; // Assuming alias for analytics.js
import { repository } from '~repository'; // Assuming alias for repository.js

// ------------------------------------------------------------------
// 1. Data Fixtures (Same as before)
// ------------------------------------------------------------------
const mockMembers = [
    { id: 'S1', name: 'Alice', aliases: ['Ally'], groupName: 'Group A' },
    { id: 'S2', name: 'Bob', aliases: [], groupName: 'Group A' },
    { id: 'S3', name: 'Charlie', aliases: [], groupName: 'Group B' },
    { id: 'T1', name: 'Teacher Tom', aliases: [], groupName: 'Faculty' },
    { id: 'I1', name: 'Ignored Ivan', aliases: [], groupName: 'Other' },
];

const mockMeets = [
    // Meet 1: Group A Session
    {
        id: 'M1', meetId: 'GROUP_A_MEET', date: '2024-11-01', startTime: '10:00', endTime: '11:00',
        participants: [
            { name: 'Alice', duration: 40 * 60, joinTime: '10:00' },
            { name: 'Ally', duration: 20 * 60, joinTime: '10:15' },
            { name: 'Bob', duration: 60 * 60, joinTime: '10:00' },
            { name: 'Teacher Tom', duration: 60 * 60, joinTime: '10:00' },
            { name: 'Ignored Ivan', duration: 10 * 60, joinTime: '10:50' },
        ]
    },
    // Meet 2: Group A Session
    {
        id: 'M2', meetId: 'GROUP_A_MEET', date: '2024-11-02', startTime: '12:00', endTime: '13:00',
        participants: [
            { name: 'Alice', duration: 60 * 60, joinTime: '12:00' },
            { name: 'Charlie', duration: 10 * 60, joinTime: '12:50' },
        ]
    },
    // Meet 3: Group B Session
    {
        id: 'M3', meetId: 'MISC_MEET', date: '2024-11-03', startTime: '14:00', endTime: '15:00',
        participants: [
            { name: 'Charlie', duration: 30 * 60, joinTime: '14:00' },
            { name: 'Alice', duration: 10 * 60, joinTime: '14:50' },
        ]
    }
];

const mockGroupsMap = {
    'GROUP_A_MEET': { meetId: 'GROUP_A_MEET', name: 'Group A' },
};


// ------------------------------------------------------------------
// 2. Mock Factory (Ensure Path Match - using assumed alias '~repository')
// If the alias is actually '~services/repository', replace the string below.
// ------------------------------------------------------------------
vi.mock('~repository', () => {
    return {
        repository: {
            getAllMeets: vi.fn(),
            getIgnoredUsers: vi.fn(),
            getTeachers: vi.fn(),
            getGroupMap: vi.fn(),
            getAll: vi.fn(),
            getMeetsByMeetId: vi.fn(),
            getMeetById: vi.fn(),
        }
    };
});


// ------------------------------------------------------------------
// 3. Defaults Setter
// ------------------------------------------------------------------
const setRepositoryDefaults = () => {
    // We use vi.mocked() here because we are in the test scope and 'repository'
    // correctly points to the mock created above.
    vi.mocked(repository.getAllMeets).mockResolvedValue(mockMeets);
    vi.mocked(repository.getIgnoredUsers).mockResolvedValue(['Ignored Ivan']);
    vi.mocked(repository.getTeachers).mockResolvedValue(['Teacher Tom']);
    vi.mocked(repository.getGroupMap).mockResolvedValue(mockGroupsMap);
    vi.mocked(repository.getAll).mockResolvedValue(mockMembers);

    vi.mocked(repository.getMeetsByMeetId).mockResolvedValue(mockMeets.filter(m => m.meetId === 'GROUP_A_MEET'));
    vi.mocked(repository.getMeetById).mockResolvedValue(null);
};


// ------------------------------------------------------------------
// 4. Test Suite
// ------------------------------------------------------------------
describe('analytics service', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        setRepositoryDefaults();
    });

    // --- getGlobalStats Tests ---
    describe('getGlobalStats', () => {
        it('should correctly calculate stats for meets with strict group filtering', async () => {
            const stats = await analytics.getGlobalStats();
            const groupAStats = stats.find(s => s.meetId === 'GROUP_A_MEET');

            expect(stats.length).toBe(2);
            expect(groupAStats.totalDuration).toBe(7200);
            expect(groupAStats.attendancePercentage).toBe(100);
        });

        it('should correctly handle meets without a group map entry (legacy behavior)', async () => {
            const stats = await analytics.getGlobalStats();
            const miscMeetStats = stats.find(s => s.meetId === 'MISC_MEET');

            expect(miscMeetStats).toBeDefined();
            expect(miscMeetStats.totalSessions).toBe(1);
            expect(miscMeetStats.totalDuration).toBe(1800);
        });
    });

    // --- getDetailedStats Tests ---
    describe('getDetailedStats', () => {
        beforeEach(() => {
            vi.mocked(repository.getMeetsByMeetId).mockResolvedValue(mockMeets.filter(m => m.meetId === 'GROUP_A_MEET'));
        });

        it('should aggregate durations by date', async () => {
            const detailedStats = await analytics.getDetailedStats('GROUP_A_MEET');
            expect(detailedStats.dates).toEqual(['2024-11-01', '2024-11-02']);
            const bobRow = detailedStats.matrix.find(r => r.name === 'Bob');
            expect(bobRow.totalPercentage).toBe(50);
        });

        it('should apply teacher exclusion', async () => {
            const detailedStats = await analytics.getDetailedStats('GROUP_A_MEET', 'Bob');
            const names = detailedStats.matrix.map(r => r.name);
            expect(names).not.toContain('Bob');
        });
    });

    // --- getSingleReportStats Tests ---
    describe('getSingleReportStats', () => {
        const singleMeet = mockMeets[0];

        beforeEach(() => {
            vi.mocked(repository.getMeetById).mockResolvedValue(singleMeet);
        });

        it('should calculate stats for a single meet', async () => {
            const stats = await analytics.getSingleReportStats('M1');
            expect(stats.dates).toEqual([singleMeet.date]);
            expect(stats.matrix.length).toBe(3);
        });

        it('should throw if meet not found', async () => {
            vi.mocked(repository.getMeetById).mockResolvedValue(null);
            await expect(analytics.getSingleReportStats('BAD_ID')).rejects.toThrow('Meet not found');
        });
    });
});