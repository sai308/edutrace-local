import { databaseService } from './DatabaseService';

export class BaseRepository {
    /**
     * @param {string} storeName - Name of the object store
     */
    constructor(storeName) {
        this.storeName = storeName;
    }

    /**
     * Get database instance
     */
    async getDb() {
        return databaseService.getDb();
    }

    async getAll() {
        const db = await this.getDb();
        return db.getAll(this.storeName);
    }

    async getById(id) {
        const db = await this.getDb();
        return db.get(this.storeName, id);
    }

    async add(item) {
        const db = await this.getDb();
        return db.add(this.storeName, item);
    }

    async put(item) {
        const db = await this.getDb();
        return db.put(this.storeName, item);
    }

    async delete(id) {
        const db = await this.getDb();
        return db.delete(this.storeName, id);
    }

    async getAllFromIndex(indexName, query) {
        const db = await this.getDb();
        return db.getAllFromIndex(this.storeName, indexName, query);
    }

    async getFromIndex(indexName, query) {
        const db = await this.getDb();
        return db.getFromIndex(this.storeName, indexName, query);
    }
    async bulkPut(items) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        await Promise.all(items.map(item => store.put(item)));
        await tx.done;
    }

    async bulkDelete(ids) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    }
}
