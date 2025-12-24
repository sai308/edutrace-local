
// Actually, in Phase 1 we migrated to specific repositories but kept `repository/index.js` as facade.
// For Phase 2, we should use the specific repositories if possible, or the facade if it simplifies things.
// `useStudents.js` used `../services/repository` (facade). 
// The facsimile `repository` is located at `src/services/repository/index.js`.
// But we want to use the new modular Structure.
// `src/modules/Students/services/students.repository.js` exists.
// `src/shared/services/settings.repository.js` exists.
// `src/modules/Analytics/services/meets.repository.js` exists.
// `src/modules/Marks/services/tasks.repository.js` exists.

// To avoid circular or messy imports, checking `repository/index.js` content showed it exports everything.
// Accessing it via facade is safer for now to avoid Missing Exports, OR we can import specific ones.
// Given strict "Module" refactoring, we should import what we need.

import { studentsRepository } from './students.repository';

export class StudentsService {
    async saveStudent(formData, originalStudent) {
        const oldName = originalStudent.name;
        const newName = formData.name;
        const currentId = originalStudent.id;

        const memberData = {
            id: oldName !== newName ? undefined : currentId,
            name: newName,
            email: formData.email,
            groupName: formData.groupName,
            role: originalStudent.role || 'student',
            hidden: originalStudent.hidden || false,
            aliases: originalStudent.aliases ? [...originalStudent.aliases] : []
        };

        if (oldName !== newName) {
            if (!memberData.aliases.includes(oldName)) {
                memberData.aliases.push(oldName);
            }
        }

        await studentsRepository.saveMember(memberData);
    }

    async deleteStudent(id) {
        await studentsRepository.hideMember(id);
    }

    async bulkDeleteStudents(ids) {
        await studentsRepository.hideMembers(ids);
    }
}

export const studentsService = new StudentsService();
