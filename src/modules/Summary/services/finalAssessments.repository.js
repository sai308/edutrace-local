import { BaseRepository } from '@/shared/services/BaseRepository';

class FinalAssessmentsRepository extends BaseRepository {
    constructor() {
        super('finalAssessments');
    }

    async saveFinalAssessment(assessment) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        // Check for existing assessment using composite index
        const index = store.index('student_type');
        const existing = await index.get([assessment.studentId, assessment.assessmentType]);

        if (existing) {
            // Update existing assessment
            const updated = {
                ...existing,
                ...assessment,
                id: existing.id,
                createdAt: existing.createdAt, // Preserve original creation time
            };
            await store.put(updated);
            await tx.done;
            return { id: existing.id, isNew: false, updated: true };
        }

        // New assessment
        const id = await store.add({
            ...assessment,
            createdAt: new Date().toISOString(),
            syncedAt: assessment.syncedAt || null,
            documentedAt: assessment.documentedAt || null,
        });
        await tx.done;
        return { id, isNew: true, updated: false };
    }

    async getFinalAssessmentByStudent(studentId, assessmentType) {
        const db = await this.getDb();
        // Transaction is safer for composite index access? Actually .getFromIndex is simpler if I add it to BaseRepo or just use logic here
        // BaseRepo has .getFromIndex but it takes indexName and query
        // Here we need to open transaction anyway if we want to follow pattern?
        // Actually IDB wrapping allows simple getFromIndex.
        // Let's use BaseRepo.getFromIndex if possible? 
        // BaseRepo signatures: getFromIndex(indexName, query)
        return this.getFromIndex('student_type', [studentId, assessmentType]);
    }

    async getAllFinalAssessments() {
        return this.getAll();
    }

    async getFinalAssessmentsByType(assessmentType) {
        return this.getAllFromIndex('assessmentType', assessmentType);
    }

    async deleteFinalAssessment(id) {
        return this.delete(id);
    }

    async updateSyncStatus(id, syncedAt) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        const assessment = await store.get(id);
        if (assessment) {
            assessment.syncedAt = syncedAt;
            await store.put(assessment);
        }
        await tx.done;
    }

    async updateDocumentStatus(id, documentedAt) {
        const db = await this.getDb();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);

        const assessment = await store.get(id);
        if (assessment) {
            assessment.documentedAt = documentedAt;
            await store.put(assessment);
        }
        await tx.done;
    }
}

export const finalAssessmentsRepository = new FinalAssessmentsRepository();
