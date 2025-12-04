import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { repository } from '@/services/repository';
import { resetDbConnection } from '@/services/repository/db';

describe('FinalAssessments Repository', () => {
    afterEach(async () => {
        await resetDbConnection();
    });

    describe('saveFinalAssessment', () => {
        it('should create a new final assessment', async () => {
            const assessment = {
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            };

            const result = await repository.saveFinalAssessment(assessment);

            expect(result.isNew).toBe(true);
            expect(result.updated).toBe(false);
            expect(result.id).toBeTypeOf('number');

            // Verify it was saved
            const saved = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(saved).toMatchObject({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });
            expect(saved.createdAt).toBeDefined();
            expect(saved.syncedAt).toBeNull();
            expect(saved.documentedAt).toBeNull();
        });

        it('should update existing assessment for same student and type', async () => {
            // Create initial assessment
            const initial = {
                studentId: 1,
                assessmentType: 'exam',
                grade: 80,
                isAutomatic: true,
            };
            const firstResult = await repository.saveFinalAssessment(initial);

            // Update with new grade
            const updated = {
                studentId: 1,
                assessmentType: 'exam',
                grade: 90,
                isAutomatic: false,
            };
            const secondResult = await repository.saveFinalAssessment(updated);

            expect(secondResult.isNew).toBe(false);
            expect(secondResult.updated).toBe(true);
            expect(secondResult.id).toBe(firstResult.id);

            // Verify update
            const saved = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(saved.grade).toBe(90);
            expect(saved.isAutomatic).toBe(false);
            expect(saved.createdAt).toBe((await repository.getFinalAssessmentByStudent(1, 'exam')).createdAt);
        });

        it('should allow different assessment types for same student', async () => {
            const exam = {
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            };
            const credit = {
                studentId: 1,
                assessmentType: 'credit',
                grade: 90,
                isAutomatic: false,
            };

            await repository.saveFinalAssessment(exam);
            await repository.saveFinalAssessment(credit);

            const savedExam = await repository.getFinalAssessmentByStudent(1, 'exam');
            const savedCredit = await repository.getFinalAssessmentByStudent(1, 'credit');

            expect(savedExam.grade).toBe(85);
            expect(savedCredit.grade).toBe(90);
        });

        it('should preserve timestamps on update', async () => {
            const assessment = {
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            };

            await repository.saveFinalAssessment(assessment);
            const first = await repository.getFinalAssessmentByStudent(1, 'exam');
            const originalCreatedAt = first.createdAt;

            // Wait a bit and update
            await new Promise(resolve => setTimeout(resolve, 10));

            await repository.saveFinalAssessment({
                ...assessment,
                grade: 90,
            });

            const updated = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(updated.createdAt).toBe(originalCreatedAt);
        });
    });

    describe('getFinalAssessmentByStudent', () => {
        it('should return undefined for non-existent assessment', async () => {
            const result = await repository.getFinalAssessmentByStudent(999, 'exam');
            expect(result).toBeUndefined();
        });

        it('should retrieve specific assessment by student and type', async () => {
            await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });

            const result = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(result).toBeDefined();
            expect(result.studentId).toBe(1);
            expect(result.assessmentType).toBe('exam');
        });
    });

    describe('getAllFinalAssessments', () => {
        it('should return empty array when no assessments exist', async () => {
            const result = await repository.getAllFinalAssessments();
            expect(result).toEqual([]);
        });

        it('should return all assessments', async () => {
            await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });
            await repository.saveFinalAssessment({
                studentId: 2,
                assessmentType: 'credit',
                grade: 90,
                isAutomatic: false,
            });

            const result = await repository.getAllFinalAssessments();
            expect(result).toHaveLength(2);
        });
    });

    describe('getFinalAssessmentsByType', () => {
        it('should filter assessments by type', async () => {
            await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });
            await repository.saveFinalAssessment({
                studentId: 2,
                assessmentType: 'exam',
                grade: 90,
                isAutomatic: false,
            });
            await repository.saveFinalAssessment({
                studentId: 3,
                assessmentType: 'credit',
                grade: 95,
                isAutomatic: true,
            });

            const exams = await repository.getFinalAssessmentsByType('exam');
            const credits = await repository.getFinalAssessmentsByType('credit');

            expect(exams).toHaveLength(2);
            expect(credits).toHaveLength(1);
            expect(exams.every(a => a.assessmentType === 'exam')).toBe(true);
            expect(credits.every(a => a.assessmentType === 'credit')).toBe(true);
        });
    });

    describe('deleteFinalAssessment', () => {
        it('should delete an assessment', async () => {
            const result = await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });

            await repository.deleteFinalAssessment(result.id);

            const retrieved = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('updateAssessmentSyncStatus', () => {
        it('should update sync timestamp', async () => {
            const result = await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });

            const syncTime = new Date().toISOString();
            await repository.updateAssessmentSyncStatus(result.id, syncTime);

            const updated = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(updated.syncedAt).toBe(syncTime);
        });

        it('should not affect other fields', async () => {
            const result = await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });

            const before = await repository.getFinalAssessmentByStudent(1, 'exam');
            const syncTime = new Date().toISOString();
            await repository.updateAssessmentSyncStatus(result.id, syncTime);
            const after = await repository.getFinalAssessmentByStudent(1, 'exam');

            expect(after.grade).toBe(before.grade);
            expect(after.isAutomatic).toBe(before.isAutomatic);
            expect(after.createdAt).toBe(before.createdAt);
        });
    });

    describe('updateAssessmentDocumentStatus', () => {
        it('should update document timestamp', async () => {
            const result = await repository.saveFinalAssessment({
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            });

            const docTime = new Date().toISOString();
            await repository.updateAssessmentDocumentStatus(result.id, docTime);

            const updated = await repository.getFinalAssessmentByStudent(1, 'exam');
            expect(updated.documentedAt).toBe(docTime);
        });
    });

    describe('unique constraint', () => {
        it('should enforce unique constraint on student_type composite index', async () => {
            const assessment = {
                studentId: 1,
                assessmentType: 'exam',
                grade: 85,
                isAutomatic: true,
            };

            // First save should succeed
            const first = await repository.saveFinalAssessment(assessment);
            expect(first.isNew).toBe(true);

            // Second save with same student and type should update, not create new
            const second = await repository.saveFinalAssessment({
                ...assessment,
                grade: 90,
            });
            expect(second.isNew).toBe(false);
            expect(second.id).toBe(first.id);

            // Verify only one record exists
            const all = await repository.getAllFinalAssessments();
            expect(all).toHaveLength(1);
        });
    });
});
