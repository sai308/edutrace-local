import { repository } from './repository';

export const analytics = {
    async getGlobalStats(meets = null) {
        if (!meets) {
            meets = await repository.getAllMeets();
        }

        const [ignoredUsers, teachers, groupsMap, allStudents] = await Promise.all([
            repository.getIgnoredUsers(),
            repository.getTeachers(),
            repository.getGroupMap(),
            repository.getAll('members')
        ]);

        const ignoredSet = new Set([...ignoredUsers, ...teachers]);

        // Build lookup maps
        const nameToMember = new Map(); // Name/Alias -> Member Object
        const groupToMembers = {}; // GroupName -> Set(Member Objects)

        allStudents.forEach(s => {
            // Map name and aliases to member
            nameToMember.set(s.name, s);
            if (s.aliases) {
                s.aliases.forEach(a => nameToMember.set(a, s));
            }

            // Group grouping
            if (s.groupName) {
                if (!groupToMembers[s.groupName]) {
                    groupToMembers[s.groupName] = new Set();
                }
                groupToMembers[s.groupName].add(s);
            }
        });

        const grouped = {};

        meets.forEach(meet => {
            if (!grouped[meet.meetId]) {
                grouped[meet.meetId] = {
                    meetId: meet.meetId,
                    totalSessions: 0,
                    totalDuration: 0,
                    totalParticipantAppearances: 0,
                    lastActive: meet.date,
                    participants: new Set(), // Set of Member IDs (or Names if no ID)
                    activeMemberIds: new Set() // Track unique active members
                };
            }

            const stats = grouped[meet.meetId];
            stats.totalSessions++;
            if (meet.date > stats.lastActive) {
                stats.lastActive = meet.date;
            }

            // Determine strict group membership
            const group = groupsMap[meet.meetId];
            const targetGroupMembers = group ? groupToMembers[group.name] : null;

            let sessionMaxDuration = 0;

            meet.participants.forEach(p => {
                if (ignoredSet.has(p.name)) return;

                const member = nameToMember.get(p.name);

                // Strict Filtering:
                // If the group is defined, ONLY count if the participant is a member of that group.
                if (targetGroupMembers) {
                    if (member && targetGroupMembers.has(member)) {
                        stats.participants.add(member.id); // Use ID for uniqueness
                        stats.activeMemberIds.add(member.id);
                        stats.totalParticipantAppearances++;
                        if (p.duration > sessionMaxDuration) sessionMaxDuration = p.duration;
                    }
                } else {
                    // No group defined, fallback to counting everyone (legacy behavior)
                    stats.participants.add(p.name);
                    stats.totalParticipantAppearances++;
                    if (p.duration > sessionMaxDuration) sessionMaxDuration = p.duration;
                }
            });
            stats.totalDuration += sessionMaxDuration;
        });

        return Object.values(grouped).map(g => {
            const group = groupsMap[g.meetId];
            let uniqueParticipantsCount = 0;
            let activeParticipantsCount = 0;

            if (group && groupToMembers[group.name]) {
                // Denominator = All Members of the Group
                const groupMembers = groupToMembers[group.name];

                // Filter ignored members from the denominator
                let validMembersCount = 0;
                groupMembers.forEach(m => {
                    if (!ignoredSet.has(m.name)) validMembersCount++;
                });

                uniqueParticipantsCount = validMembersCount;
                activeParticipantsCount = g.activeMemberIds.size;
            } else {
                // Fallback
                uniqueParticipantsCount = g.participants.size;
                activeParticipantsCount = g.participants.size;
            }

            const totalPossibleAppearances = g.totalSessions * uniqueParticipantsCount;
            const attendancePercentage = totalPossibleAppearances > 0
                ? Math.round((g.totalParticipantAppearances / totalPossibleAppearances) * 100)
                : 0;

            return {
                ...g,
                uniqueParticipantsCount,
                activeParticipantsCount,
                avgDuration: g.totalSessions > 0 ? (g.totalDuration / g.totalSessions) / 60 : 0,
                attendancePercentage,
                totalPossibleAppearances
            };
        });
    },

    async getDetailedStats(meetId, teacherName = null) {
        const [meets, groupsMap, allStudents] = await Promise.all([
            repository.getMeetsByMeetId(meetId),
            repository.getGroupMap(),
            repository.getAll('members')
        ]);

        const ignoredUsers = await repository.getIgnoredUsers();
        const teachers = await repository.getTeachers();
        const ignoredSet = new Set([...ignoredUsers, ...teachers]);

        if (teacherName) {
            ignoredSet.add(teacherName);
        }

        // Identify group and its students
        const group = groupsMap[meetId];
        const groupStudents = new Set();
        if (group) {
            allStudents.forEach(s => {
                if (s.groupName === group.name) {
                    groupStudents.add(s.name);
                }
            });
        }

        // Squash by date
        const sessionsByDate = {};
        const allParticipants = new Set();

        // Pass 1: Aggregate durations per date
        meets.forEach(meet => {
            const date = meet.date; // YYYY-MM-DD
            if (!sessionsByDate[date]) {
                sessionsByDate[date] = {
                    date,
                    participants: {},
                    maxDuration: 0,
                    startTime: meet.startTime || null,
                    endTime: meet.endTime || null
                };
            } else {
                // Update start/end times if multiple meets on same day
                if (meet.startTime && (!sessionsByDate[date].startTime || meet.startTime < sessionsByDate[date].startTime)) {
                    sessionsByDate[date].startTime = meet.startTime;
                }
                if (meet.endTime && (!sessionsByDate[date].endTime || meet.endTime > sessionsByDate[date].endTime)) {
                    sessionsByDate[date].endTime = meet.endTime;
                }
            }

            meet.participants.forEach(p => {
                if (ignoredSet.has(p.name)) return;

                allParticipants.add(p.name);

                if (!sessionsByDate[date].participants[p.name]) {
                    sessionsByDate[date].participants[p.name] = 0;
                }
                sessionsByDate[date].participants[p.name] += p.duration;
            });
        });

        // Add missing group students to allParticipants
        groupStudents.forEach(name => {
            if (!ignoredSet.has(name)) {
                allParticipants.add(name);
            }
        });

        // Pass 2: Calculate max duration for each date (after aggregation)
        Object.values(sessionsByDate).forEach(session => {
            const durations = Object.values(session.participants);
            if (durations.length > 0) {
                session.maxDuration = Math.max(...durations);
            } else {
                session.maxDuration = 0;
            }
        });

        // Pass 3: Calculate percentages
        const dates = Object.keys(sessionsByDate).sort();
        const participantsList = Array.from(allParticipants).sort();

        const matrix = participantsList.map(name => {
            const row = { name, totalDuration: 0, totalPossible: 0 };

            dates.forEach(date => {
                const duration = sessionsByDate[date].participants[name] || 0;
                const max = sessionsByDate[date].maxDuration || 1; // avoid div by 0
                const percentage = Math.round((duration / max) * 100);

                row[date] = {
                    duration,
                    percentage,
                    status: getStatusColor(percentage)
                };

                row.totalDuration += duration;
                row.totalPossible += max;
            });

            // Total % across all dates
            // Weighted average based on session lengths
            row.totalPercentage = row.totalPossible > 0
                ? Math.round((row.totalDuration / row.totalPossible) * 100)
                : 0;

            return row;
        });

        return {
            dates,
            matrix,
            sessions: sessionsByDate // Return the sessions object containing metadata
        };
    },

    async getSingleReportStats(id) {
        const meet = await repository.getMeetById(id);
        if (!meet) throw new Error('Meet not found');

        const ignoredUsers = await repository.getIgnoredUsers();
        const teachers = await repository.getTeachers();
        const ignoredSet = new Set([...ignoredUsers, ...teachers]);

        const date = meet.date;
        const participants = meet.participants.filter(p => !ignoredSet.has(p.name));

        // Calculate max duration for this single session
        let maxDuration = 0;
        participants.forEach(p => {
            if (p.duration > maxDuration) maxDuration = p.duration;
        });
        if (maxDuration === 0) maxDuration = 1;

        const matrix = participants.map(p => {
            const percentage = Math.round((p.duration / maxDuration) * 100);
            return {
                name: p.name,
                joinTime: p.joinTime || null,
                totalDuration: p.duration,
                totalPossible: maxDuration,
                totalPercentage: percentage,
                [date]: {
                    duration: p.duration,
                    percentage,
                    status: getStatusColor(percentage)
                }
            };
        }).sort((a, b) => b.totalDuration - a.totalDuration);

        // Mock session object for compatibility
        const sessions = {
            [date]: {
                date,
                participants: participants.reduce((acc, p) => ({ ...acc, [p.name]: p.duration }), {}),
                maxDuration,
                startTime: meet.startTime,
                endTime: meet.endTime,
                attendees: participants.length
            }
        };

        return {
            dates: [date],
            matrix,
            sessions,
            metadata: {
                filename: meet.filename,
                uploadedAt: meet.uploadedAt,
                startTime: meet.startTime,
                endTime: meet.endTime,
                meetId: meet.meetId,
                date: meet.date
            }
        };
    }
};

function getStatusColor(percentage) {
    if (percentage <= 15) return 'bg-red-500 text-white';
    if (percentage <= 30) return 'bg-red-400 text-white'; // Bright Red
    if (percentage <= 50) return 'bg-yellow-200 text-black'; // Yellow
    if (percentage <= 75) return 'bg-yellow-400 text-black'; // Bright Yellow
    return 'bg-green-500 text-white';
}
