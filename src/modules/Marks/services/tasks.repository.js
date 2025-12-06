import { BaseRepository } from '@/shared/services/BaseRepository';

class TasksRepository extends BaseRepository {
    constructor() {
        super('tasks');
    }

    async saveTask(task) {
        if (task.id) {
            return this.put(task);
        }
        return this.add(task);
    }

    async getAllTasks() {
        return this.getAll();
    }

    async getTasksByGroup(groupName) {
        return this.getAllFromIndex('groupName', groupName);
    }

    async findTaskByNaturalKey(name, date, groupName) {
        const db = await this.getDb();
        // Uses composite index: [name, date, groupName]
        return db.getFromIndex(this.storeName, 'name_date_group', [name, date, groupName]);
    }
}

export const tasksRepository = new TasksRepository();
