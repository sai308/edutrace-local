import { groupsRepository } from './groups.repository';
import { meetsRepository } from '../../Analytics/services/meets.repository';
import { studentsRepository } from '../../Students/services/students.repository';
import { tasksRepository } from '../../Marks/services/tasks.repository';
import { marksRepository } from '../../Marks/services/marks.repository';
import { settingsRepository } from '@/shared/services/settings.repository';

import { v4 as uuidv4 } from 'uuid';

import * as Comlink from 'comlink';
import GroupsWorker from '@/workers/groups.worker?worker';

export class GroupsService {
    constructor() {
        this.worker = Comlink.wrap(new GroupsWorker());
    }

    async loadGroupsData() {
        const [groups, meets, members, teacherList, allTasks, allMarks] = await Promise.all([
            groupsRepository.getGroups(),
            meetsRepository.getAll(),
            studentsRepository.getAllMembers(),
            settingsRepository.getTeachers(),
            tasksRepository.getAll(),
            marksRepository.getAll()
        ]);

        // Pass data as plain objects to remove proxies
        const payload = [
            JSON.parse(JSON.stringify(groups)),
            JSON.parse(JSON.stringify(meets)),
            JSON.parse(JSON.stringify(members)),
            JSON.parse(JSON.stringify(teacherList)),
            JSON.parse(JSON.stringify(allTasks)),
            JSON.parse(JSON.stringify(allMarks))
        ];

        return await this.worker.processGroupsData(...payload);
    }

    async saveGroup(formData) {
        if (!formData.name || !formData.meetId) {
            throw new Error('Validation failed: Name and Meet ID are required');
        }
        const group = {
            id: formData.id || uuidv4(),
            ...formData
        };
        await groupsRepository.saveGroup(group);
        return group;
    }

    async deleteGroup(id) {
        await groupsRepository.deleteGroup(id);
    }
}

export const groupsService = new GroupsService();
