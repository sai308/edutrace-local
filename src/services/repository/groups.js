// groups.js
import { getDb } from './db';
import { getMeetsByMeetId } from './meets';
import { syncParticipants } from './members';

export async function getGroups() {
    const db = await getDb();
    return db.getAll('groups');
}

export async function getGroupById(id) {
    const db = await getDb();
    return db.get('groups', id);
}

export async function saveGroup(group) {
    const db = await getDb();
    // Put operation is inherently transactional
    await db.put('groups', group);

    // Sync members from existing meets for this group (side effect)
    if (group.meetId) {
        await syncMembersFromMeets(group);
    }
    return group.id;
}

export async function deleteGroup(id) {
    const db = await getDb();
    return db.delete('groups', id);
}

export async function getGroupMap() {
    const groups = await getGroups();
    const map = {};
    groups.forEach(g => {
        map[g.meetId] = g;
    });
    return map;
}

export async function syncMembersFromMeets(group) {
    // Note: getMeetsByMeetId and syncParticipants handle their own DB access
    const meets = await getMeetsByMeetId(group.meetId);
    await syncParticipants(meets, group.name);
}