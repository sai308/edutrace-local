
import { v4 as uuidv4 } from 'uuid';
import { studentsRepository } from '@/modules/Students/services/students.repository.js';

export class IdentityReconciler {
    /**
     * Matches raw student data to existing members.
     * @param {Array<{name: string, email?: string, groupName: string}>} rawStudents
     * @returns {Promise<Array<{id: string, isNew: boolean, name: string, email: string, groupName: string, [key: string]: any}>>}
     */
    async resolveIdentities(rawStudents) {
        const existingMembers = await studentsRepository.getAllMembers();

        // Create lookup maps
        const emailMap = new Map();
        const nameMap = new Map();

        existingMembers.forEach(member => {
            if (member.email) {
                emailMap.set(member.email.toLowerCase(), member);
            }
            if (member.name) {
                nameMap.set(this._normalizeName(member.name), member);
            }
        });

        return rawStudents.map(student => {
            let match = null;
            let isNew = false;
            let matchedByEmail = false;

            // Priority 1: Match by Email
            if (student.email && emailMap.has(student.email.toLowerCase())) {
                match = emailMap.get(student.email.toLowerCase());
                matchedByEmail = true;
            }

            // Priority 2: Match by Normalized Name (only if no email match)
            if (!match && student.name) {
                const normalizedName = this._normalizeName(student.name);
                if (nameMap.has(normalizedName)) {
                    match = nameMap.get(normalizedName);
                }
            }

            // Prepare result
            if (match) {
                return {
                    ...student,
                    ...match, // Keep existing member data
                    // Update email if matched by name but raw has email (and existing doesn't or is different? Policy says: Update the email if the match was found by name but the record has a new email)
                    email: !matchedByEmail && student.email ? student.email : match.email,
                    isNew: false
                };
            } else {
                return {
                    ...student,
                    id: uuidv4(),
                    isNew: true,
                    // Ensure email is present
                    email: student.email || ''
                };
            }
        });
    }

    /**
     * Normalizes a name string: lowercase, removed spaces.
     * @param {string} name 
     * @returns {string}
     */
    _normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/\s+/g, '');
    }
}
