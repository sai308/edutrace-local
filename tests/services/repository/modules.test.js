import { describe, it, expect, beforeEach } from 'vitest';
import { saveModule, getAllModules, getModulesByGroup, getModuleById, deleteModule } from '@/services/repository/modules';
import { getDb } from '@/services/repository/db';

// Mock the db module
vi.mock('@/services/repository/db', () => ({
    getDb: vi.fn()
}));

describe('Modules Repository', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = {
            put: vi.fn(),
            getAll: vi.fn(),
            getAllFromIndex: vi.fn(),
            get: vi.fn(),
            delete: vi.fn()
        };
        getDb.mockResolvedValue(mockDb);
    });

    it('should save a module', async () => {
        const module = { id: 1, name: 'Test Module', groupName: 'Group A' };
        mockDb.put.mockResolvedValue(1);

        const result = await saveModule(module);

        expect(mockDb.put).toHaveBeenCalledWith('modules', module);
        expect(result).toBe(1);
    });

    it('should get all modules', async () => {
        const modules = [{ id: 1, name: 'M1' }, { id: 2, name: 'M2' }];
        mockDb.getAll.mockResolvedValue(modules);

        const result = await getAllModules();

        expect(mockDb.getAll).toHaveBeenCalledWith('modules');
        expect(result).toEqual(modules);
    });

    it('should get modules by group', async () => {
        const groupName = 'Group A';
        const modules = [{ id: 1, name: 'M1', groupName }];
        mockDb.getAllFromIndex.mockResolvedValue(modules);

        const result = await getModulesByGroup(groupName);

        expect(mockDb.getAllFromIndex).toHaveBeenCalledWith('modules', 'groupName', groupName);
        expect(result).toEqual(modules);
    });

    it('should get module by id', async () => {
        const id = 1;
        const module = { id, name: 'M1' };
        mockDb.get.mockResolvedValue(module);

        const result = await getModuleById(id);

        expect(mockDb.get).toHaveBeenCalledWith('modules', id);
        expect(result).toEqual(module);
    });

    it('should delete a module', async () => {
        const id = 1;
        mockDb.delete.mockResolvedValue(undefined);

        await deleteModule(id);

        expect(mockDb.delete).toHaveBeenCalledWith('modules', id);
    });
});
