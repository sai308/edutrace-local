import { BaseRepository } from '@/shared/services/BaseRepository';

class ModulesRepository extends BaseRepository {
    constructor() {
        super('modules');
    }

    async saveModule(module) {
        if (module.id) {
            return this.put(module);
        }
        return this.add(module);
    }

    async getAllModules() {
        return this.getAll();
    }

    async getModulesByGroup(groupName) {
        return this.getAllFromIndex('groupName', groupName);
    }

    async getModuleById(id) {
        return this.getById(id);
    }

    async deleteModule(id) {
        return this.delete(id);
    }
}

export const modulesRepository = new ModulesRepository();
