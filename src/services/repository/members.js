// members.js
import { getDb } from './db';
import { getTeachers } from './settings';
import { getAllMeets } from './meets';
import { getGroupMap } from './groups';

export async function getAllMembers() {
    const db = await getDb();
    return db.getAll('members');
}

/**
 * Builds a map of member names/aliases to the full member object.
 * @returns {Promise<Map<string, Member>>}
 */
async function buildMemberNameMap() {
    const allMembers = await getAllMembers();
    const memberMap = new Map();
    allMembers.forEach(m => {
        memberMap.set(m.name, m);
        if (m.aliases) {
            m.aliases.forEach(a => memberMap.set(a, m));
        }
    });
    return memberMap;
}

export async function syncAllMembersFromMeets() {
    const meets = await getAllMeets();
    const groupMap = await getGroupMap();
    const memberMap = await buildMemberNameMap();

    const db = await getDb();
    const tx = db.transaction('members', 'readwrite');
    const store = tx.objectStore('members');

    for (const meet of meets) {
        const group = groupMap[meet.meetId];
        const groupName = group ? group.name : '';

        for (const p of meet.participants) {
            if (!memberMap.has(p.name)) {
                const newMember = {
                    name: p.name,
                    groupName: groupName,
                    email: p.email || '',
                    role: 'student',
                    aliases: [],
                    hidden: false
                };
                // Store.add returns a Promise that must be awaited within the transaction scope
                const id = await store.add(newMember);
                newMember.id = id;
                memberMap.set(p.name, newMember);
            }
        }
    }
    await tx.done;
}

export async function getMembersByGroup(groupName) {
    const db = await getDb();
    return db.getAllFromIndex('members', 'groupName', groupName);
}

export async function getMemberById(id) {
    const db = await getDb();
    return db.get('members', id);
}

export async function saveMember(member) {
    // Resolve role outside the transaction
    let role = member.role;
    if (!role) {
        const teachers = await getTeachers();
        role = teachers.includes(member.name) ? 'teacher' : 'student';
    }

    const db = await getDb();
    const tx = db.transaction('members', 'readwrite');
    const store = tx.objectStore('members');

    let existing;
    if (member.id) {
        existing = await store.get(member.id);
    }

    // If no ID provided or ID search failed, try lookup by name
    if (!existing && member.name) {
        const index = store.index('name');
        existing = await index.get(member.name);
    }

    if (existing) {
        // Merge existing with new data
        const updated = {
            aliases: [], // Default
            ...existing,
            ...member,
            id: existing.id,
            role: role // Always prioritize calculated/provided role
        };
        await store.put(updated);
        await tx.done;
        return existing.id;
    }

    // New member
    const newMember = { aliases: [], ...member, role };
    const id = await store.add(newMember);
    await tx.done;
    return id;
}

export async function deleteMember(id) {
    const db = await getDb();
    return db.delete('members', id);
}

export async function deleteMembers(ids) {
    const db = await getDb();
    const tx = db.transaction('members', 'readwrite');
    const store = tx.objectStore('members');

    await Promise.all(ids.map(id => store.delete(id)));

    await tx.done;
}

export async function hideMember(id) {
    const db = await getDb();
    const tx = db.transaction('members', 'readwrite');
    const store = tx.objectStore('members');

    const member = await store.get(id);
    if (member && member.hidden !== true) {
        member.hidden = true;
        await store.put(member);
    }
    await tx.done;
}

export async function hideMembers(ids) {
    const db = await getDb();
    const tx = db.transaction('members', 'readwrite');
    const store = tx.objectStore('members');

    await Promise.all(ids.map(async id => {
        const member = await store.get(id);
        if (member && member.hidden !== true) {
            member.hidden = true;
            await store.put(member);
        }
    }));
    await tx.done;
}

/**
 * Sync participants from a list of meets for a specific group.
 * @param {Meet[]} meets
 * @param {string} groupName
 */
export async function syncParticipants(meets, groupName) {
    // Note: Calling buildMemberNameMap() inside a transaction can cause deadlock 
    // if it relies on getDb() which might be in use elsewhere.
    // It's safer to build the map before the transaction.
    const memberMap = await buildMemberNameMap();

    const db = await getDb();
    const tx = db.transaction('members', 'readwrite');
    const store = tx.objectStore('members');

    for (const meet of meets) {
        for (const p of meet.participants) {
            if (!memberMap.has(p.name)) {
                const newMember = {
                    name: p.name,
                    groupName: groupName,
                    email: p.email || '',
                    role: 'student',
                    aliases: [],
                    hidden: false
                };
                const id = await store.add(newMember);
                newMember.id = id;
                memberMap.set(p.name, newMember);
            }
        }
    }
    await tx.done;
}