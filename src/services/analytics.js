import { repository } from '~services/repository';

// --- Private Utility Functions (Moved outside of the exported object) ---

/**
 * Builds lookup maps for members (students).
 * @param {Array<Object>} allMembers - Array of member objects.
 * @returns {{nameToMember: Map, groupToMembers: Object<string, Set<Object>>}} Lookup maps.
 */
const buildMemberLookups = (allMembers) => {
    const nameToMember = new Map(); // Name/Alias -> Member Object
    const groupToMembers = {};      // GroupName -> Set(Member Objects)

    allMembers.forEach(s => {
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

    return { nameToMember, groupToMembers };
};

/**
 * Fetches common data required for analytics and builds the ignored set.
 * @returns {Promise<{ignoredSet: Set<string>, groupsMap: Object, allStudents: Array<Object>}>}
 */
const fetchCommonData = async () => {
    const [
        ignoredUsers,
        teachers,
        groupsMap,
        allStudents
    ] = await Promise.all([
        repository.getIgnoredUsers(),
        repository.getTeachers(),
        repository.getGroupMap(),
        repository.getAll('members')
    ]);

    const ignoredSet = new Set([...ignoredUsers, ...teachers]);
    return { ignoredSet, groupsMap, allStudents };
};


/**
 * Determines the status color based on attendance percentage.
 * @param {number} percentage - The attendance percentage.
 * @returns {string} Tailwind CSS classes for the status color.
 */
function getStatusColor(percentage) {
    if (percentage <= 15) return 'bg-red-500 text-white';
    if (percentage <= 30) return 'bg-red-400 text-white';
    if (percentage <= 50) return 'bg-yellow-200 text-black';
    if (percentage <= 75) return 'bg-yellow-400 text-black';
    return 'bg-green-500 text-white';
}

// --- Exported Service ---

export const analytics = {
    async getGlobalStats(meets = null) {
        if (!meets) {
            meets = await repository.getAllMeets();
        }

        const { ignoredSet, groupsMap, allStudents } = await fetchCommonData();
        const { nameToMember, groupToMembers } = buildMemberLookups(allStudents);

        const grouped = {};

        meets.forEach(meet => {
            const meetId = meet.meetId;
            if (!grouped[meetId]) {
                grouped[meetId] = {
                    meetId,
                    totalSessions: 0,
                    totalDuration: 0,
                    totalParticipantAppearances: 0,
                    lastActive: meet.date,
                    participants: new Set(), // Set of Member IDs (or Names if no ID)
                    activeMemberIds: new Set() // Track unique active members
                };
            }

            const stats = grouped[meetId];
            stats.totalSessions++;
            if (meet.date > stats.lastActive) {
                stats.lastActive = meet.date;
            }

            // Determine strict group membership
            const group = groupsMap[meetId];
            const targetGroupMembers = group ? groupToMembers[group.name] : null;

            let sessionMaxDuration = 0;

            meet.participants.forEach(p => {
                const participantName = p.name;
                if (ignoredSet.has(participantName)) return;

                const member = nameToMember.get(participantName);
                let shouldCountParticipant = false;

                // Strict Filtering:
                if (targetGroupMembers) {
                    if (member && targetGroupMembers.has(member)) {
                        shouldCountParticipant = true;
                    }
                } else {
                    // No group defined, fallback to counting everyone (legacy behavior)
                    shouldCountParticipant = true;
                }

                if (shouldCountParticipant) {
                    const uniqueId = member?.id || participantName;
                    stats.participants.add(uniqueId);
                    stats.totalParticipantAppearances++;
                    if (member) {
                        stats.activeMemberIds.add(member.id);
                    }
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
                // Denominator = All Members of the Group (filtered for ignored users)
                const groupMembers = groupToMembers[group.name];

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
        const meetsPromise = repository.getMeetsByMeetId(meetId);
        const { ignoredSet, groupsMap, allStudents } = await fetchCommonData();
        const meets = await meetsPromise;

        // Apply temporary teacher exclusion
        const localIgnoredSet = new Set(ignoredSet);
        if (teacherName) {
            localIgnoredSet.add(teacherName);
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

        const sessionsByDate = {};
        const allParticipants = new Set();

        // Pass 1: Aggregate durations per date
        meets.forEach(meet => {
            const date = meet.date;
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
                if (localIgnoredSet.has(p.name)) return;

                allParticipants.add(p.name);

                if (!sessionsByDate[date].participants[p.name]) {
                    sessionsByDate[date].participants[p.name] = 0;
                }
                sessionsByDate[date].participants[p.name] += p.duration;
            });
        });

        // Add missing group students to allParticipants
        groupStudents.forEach(name => {
            if (!localIgnoredSet.has(name)) {
                allParticipants.add(name);
            }
        });

        // Pass 2: Calculate max duration for each date
        Object.values(sessionsByDate).forEach(session => {
            const durations = Object.values(session.participants);
            session.maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
        });

        // Pass 3: Calculate percentages
        const dates = Object.keys(sessionsByDate).sort();
        const participantsList = Array.from(allParticipants).sort();

        const matrix = participantsList.map(name => {
            const row = { name, totalDuration: 0, totalPossible: 0 };

            dates.forEach(date => {
                const session = sessionsByDate[date];
                const duration = session.participants[name] || 0;
                const max = session.maxDuration || 1; // avoid div by 0

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
            row.totalPercentage = row.totalPossible > 0
                ? Math.round((row.totalDuration / row.totalPossible) * 100)
                : 0;

            return row;
        });

        return {
            dates,
            matrix,
            sessions: sessionsByDate
        };
    },

    async getSingleReportStats(id) {
        const meetPromise = repository.getMeetById(id);
        const { ignoredSet, allStudents } = await fetchCommonData();
        const meet = await meetPromise;

        if (!meet) throw new Error('Meet not found');

        const { nameToMember: memberGroupMap } = buildMemberLookups(allStudents);
        // Note: memberGroupMap now maps name/alias to member object,
        // we access groupName directly in the loop.

        const date = meet.date;
        const participants = meet.participants.filter(p => !ignoredSet.has(p.name));

        // Calculate max duration for this single session
        let maxDuration = 0;
        participants.forEach(p => {
            if (p.duration > maxDuration) maxDuration = p.duration;
        });
        if (maxDuration === 0) maxDuration = 1;

        const matrix = participants.map(p => {
            const member = memberGroupMap.get(p.name);
            const percentage = Math.round((p.duration / maxDuration) * 100);
            return {
                name: p.name,
                groupName: member?.groupName || '', // Access groupName from the member object
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

        // Session object for compatibility
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
