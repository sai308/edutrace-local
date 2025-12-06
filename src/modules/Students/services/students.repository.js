import { BaseRepository } from '@/shared/services/BaseRepository';

class StudentsRepository extends BaseRepository {
    constructor() {
        super('members');
    }

    async saveMember(member) {
        if (member.id) {
            return this.put(member);
        }
        return this.add(member);
    }

    async getAllMembers() {
        const members = await this.getAll();
        return members.filter(m => !m.hidden); // Filter hidden members by default
    }

    async getMembersByGroup(groupName) {
        const members = await this.getAllFromIndex('groupName', groupName);
        return members.filter(m => !m.hidden);
    }

    async deleteMembers(ids) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    }

    async syncAllMembersFromMeets() {
        const db = await this.getDb();

        // This functionality needs access to Meets repo or raw DB access
        // Since we are in the repo layer, we can access 'meets' store via DB or inject MeetRepo.
        // For simplicity/performance in this batch operation, direct DB access is fine inside the service layer
        // BUT ideally we should decouple.
        // Let's stick to direct DB for now as it was in original.

        const allMeets = await db.getAll('meets');
        const existingMembers = await this.getAll();
        const membersMap = new Map(); // Key: name, Value: member

        existingMembers.forEach(m => membersMap.set(m.name, m));

        let addedCount = 0;
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        for (const meet of allMeets) {
            if (!meet.participants) continue;

            for (const participant of meet.participants) {
                if (!membersMap.has(participant.name)) {
                    const newMember = {
                        name: participant.name,
                        groupName: meet.groupName || 'Unknown', // Inferred from meet
                        role: 'student',
                        createdAt: new Date().toISOString()
                    };
                    // Add to map to prevent duplicates in this run
                    membersMap.set(participant.name, newMember);
                    await store.add(newMember);
                    addedCount++;
                }
            }
        }
        await tx.done;
        return addedCount;
    }

    async hideMember(id) {
        const member = await this.getById(id);
        if (member) {
            member.hidden = true;
            return this.put(member);
        }
    }

    async hideMembers(ids) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        for (const id of ids) {
            const member = await store.get(id);
            if (member) {
                member.hidden = true;
                await store.put(member);
            }
        }
        await tx.done;
    }

    async clearMembers() {
        const db = await this.getDb();
        return db.clear(this.storeName);
    }

    /**
     * Sync participants from a list of meets for a specific group.
     * @param {Array} meets
     * @param {string} groupName
     */
    async syncParticipants(meets, groupName) {
        // Build map of existing members to avoid duplicates
        const existingMembers = await this.getAll();
        const memberMap = new Map();
        existingMembers.forEach(m => {
            memberMap.set(m.name, m);
            if (m.aliases) {
                m.aliases.forEach(a => memberMap.set(a, m));
            }
        });

        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        for (const meet of meets) {
            if (!meet.participants) continue;
            for (const p of meet.participants) {
                if (!memberMap.has(p.name)) {
                    const newMember = {
                        name: p.name,
                        groupName: groupName,
                        email: p.email || '',
                        role: 'student',
                        aliases: [],
                        hidden: false,
                        createdAt: new Date().toISOString()
                    };
                    const id = await store.add(newMember);
                    newMember.id = id;
                    memberMap.set(p.name, newMember); // Update map for subsequent iterations
                }
            }
        }
        await tx.done;
    }
}

export const studentsRepository = new StudentsRepository();
