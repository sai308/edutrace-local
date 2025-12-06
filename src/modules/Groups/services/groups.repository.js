import { BaseRepository } from '@/shared/services/BaseRepository';
// We need to import the OTHER repositories to handle cross-domain logic.
// In a pure architecture, this might belong in a Domain Service (Application Service), not the Repository.
// Data Core refactoring implies Services using Repositories.
// However, to match the current logic where Repository calls were nested, we will import them here for now.
import { meetsRepository } from '@/modules/Analytics/services/meets.repository';
import { studentsRepository } from '@/modules/Students/services/students.repository';

class GroupsRepository extends BaseRepository {
    constructor() {
        super('groups');
    }

    async getGroups() {
        return this.getAll();
    }

    async saveGroup(group) {
        if (group.id) {
            await this.put(group);
        } else {
            const id = await this.add(group);
            group.id = id; // Ensure ID is set for sync
        }

        // Sync members from existing meets for this group (side effect)
        if (group.meetId) {
            await this.syncMembersFromMeets(group);
        }
        return group.id;
    }

    async deleteGroup(id) {
        return this.delete(id);
    }

    async getGroupMap() {
        const groups = await this.getAll();
        const map = {}; // Keeping object return type to match original contract
        groups.forEach(g => {
            map[g.meetId] = g;
        });
        return map;
    }

    async syncMembersFromMeets(group) {
        const meets = await meetsRepository.getMeetsByMeetId(group.meetId);
        await studentsRepository.syncParticipants(meets, group.name);
    }
}

export const groupsRepository = new GroupsRepository();
