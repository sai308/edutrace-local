// finalAssessments.js
import { getDb } from './db';

/**
 * Save a final assessment (create or update)
 * Uses composite unique index (studentId, assessmentType) to prevent duplicates
 * @param {Object} assessment - The assessment object to save
 * @param {number} assessment.studentId - Student ID
 * @param {string} assessment.assessmentType - 'exam' or 'credit'
 * @param {number} assessment.grade - Grade value
 * @param {string} assessment.gradeFormat - Grade format ('5-scale', '100-scale', 'ects')
 * @param {boolean} assessment.isAutomatic - Whether grade was set automatically
 * @param {string} [assessment.syncedAt] - Sync timestamp (ISO string)
 * @param {string} [assessment.documentedAt] - Document timestamp (ISO string)
 * @returns {Promise<{id: number, isNew: boolean, updated: boolean}>}
 */
export async function saveFinalAssessment(assessment) {
    const db = await getDb();
    const tx = db.transaction('finalAssessments', 'readwrite');
    const store = tx.objectStore('finalAssessments');

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

/**
 * Get final assessment for a specific student and assessment type
 * @param {number} studentId - Student ID
 * @param {string} assessmentType - 'exam' or 'credit'
 * @returns {Promise<Object|undefined>} - Assessment object or undefined
 */
export async function getFinalAssessmentByStudent(studentId, assessmentType) {
    const db = await getDb();
    const index = db.transaction('finalAssessments').objectStore('finalAssessments').index('student_type');
    return index.get([studentId, assessmentType]);
}

/**
 * Get all final assessments
 * @returns {Promise<Array>} - Array of all assessments
 */
export async function getAllFinalAssessments() {
    const db = await getDb();
    return db.getAll('finalAssessments');
}

/**
 * Get final assessments by type
 * @param {string} assessmentType - 'exam' or 'credit'
 * @returns {Promise<Array>} - Array of assessments
 */
export async function getFinalAssessmentsByType(assessmentType) {
    const db = await getDb();
    return db.getAllFromIndex('finalAssessments', 'assessmentType', assessmentType);
}

/**
 * Delete a final assessment by ID
 * @param {number} id - Assessment ID
 * @returns {Promise<void>}
 */
export async function deleteFinalAssessment(id) {
    const db = await getDb();
    return db.delete('finalAssessments', id);
}

/**
 * Update sync status timestamp
 * @param {number} id - Assessment ID
 * @param {string} syncedAt - ISO timestamp string
 * @returns {Promise<void>}
 */
export async function updateSyncStatus(id, syncedAt) {
    const db = await getDb();
    const tx = db.transaction('finalAssessments', 'readwrite');
    const store = tx.objectStore('finalAssessments');

    const assessment = await store.get(id);
    if (assessment) {
        assessment.syncedAt = syncedAt;
        await store.put(assessment);
    }
    await tx.done;
}

/**
 * Update document status timestamp
 * @param {number} id - Assessment ID
 * @param {string} documentedAt - ISO timestamp string
 * @returns {Promise<void>}
 */
export async function updateDocumentStatus(id, documentedAt) {
    const db = await getDb();
    const tx = db.transaction('finalAssessments', 'readwrite');
    const store = tx.objectStore('finalAssessments');

    const assessment = await store.get(id);
    if (assessment) {
        assessment.documentedAt = documentedAt;
        await store.put(assessment);
    }
    await tx.done;
}
