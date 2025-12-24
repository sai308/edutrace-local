
import { v4 as uuidv4 } from 'uuid';
import { tasksRepository } from '../tasks.repository.js';
import { marksRepository } from '../marks.repository.js';
import { IdentityReconciler } from '@/shared/services/reconciliation/IdentityReconciler.js';

export class MarksReconciler {
    constructor() {
        this.identityReconciler = new IdentityReconciler();
    }

    /**
     * Reconciles parsed marks data with existing database records.
     * @param {Object} parsedData - Result from marksParser ({ groupName, tasks, studentsData })
     * @param {string} groupName
     * @returns {Promise<{students: Array, tasks: Array, marks: Array}>}
     */
    async reconcile(parsedData, groupName) {
        // Step A: Resolve Students
        // parsedData.studentsData is [{ student: {...}, marks: [...] }]
        // We need to pass just the student objects to IdentityReconciler
        const rawStudents = parsedData.studentsData.map(d => d.student);
        const resolvedStudents = await this.identityReconciler.resolveIdentities(rawStudents);

        // Step B: Reconcile Tasks
        const existingTasks = await tasksRepository.getTasksByGroup(groupName);
        const taskMap = new Map();

        // Key: "${name}|${date}"
        existingTasks.forEach(t => {
            const key = `${t.name}|${t.date}`;
            taskMap.set(key, t);
        });

        const reconciledTasks = parsedData.tasks.map(parsedTask => {
            const key = `${parsedTask.name}|${parsedTask.date}`;
            if (taskMap.has(key)) {
                const existing = taskMap.get(key);
                return {
                    ...existing, // Keep existing ID and other fields
                    ...parsedTask, // Update parsed fields (like maxPoints) if changed? 
                    // Usually we prefer existing ID.
                    id: existing.id
                };
            } else {
                return {
                    ...parsedTask,
                    id: uuidv4(),
                    groupName: groupName
                };
            }
        });

        // Step C: Reconcile Marks
        // We need existing marks to know if we should update or create (to assign ID)
        // Since we don't have a direct "getMarksByGroup" easily exposed or efficient, 
        // we'll fetch all and filter, or rely on fetching by task.
        // Given local-first, let's fetch all marks for these tasks.
        // Optimization: loop through reconciledTasks and get their IDs, then fetch marks?
        // But checking every mark one by one is slow.
        // Let's assume we can fetch all marks or a large subset. 
        // Let's use marksRepository.getAllMarks() for now as simplest approach 
        // consistent with "Phase 1: shared logic".

        const allMarks = await marksRepository.getAllMarks();
        const markLookup = new Map(); // Key: "${taskId}|${studentId}" -> mark

        allMarks.forEach(m => {
            markLookup.set(`${m.taskId}|${m.studentId}`, m);
        });

        const reconciledMarks = [];

        // resolvedStudents corresponds to parsedData.studentsData by index
        resolvedStudents.forEach((student, index) => {
            const originalData = parsedData.studentsData[index];
            const rawMarks = originalData.marks; // [{ taskIndex, score, synced }]

            rawMarks.forEach(rawMark => {
                // Find the task using taskIndex
                if (rawMark.taskIndex >= 0 && rawMark.taskIndex < reconciledTasks.length) {
                    const task = reconciledTasks[rawMark.taskIndex];
                    const taskId = task.id;
                    const studentId = student.id;

                    const lookupKey = `${taskId}|${studentId}`;
                    const existingMark = markLookup.get(lookupKey);

                    if (existingMark) {
                        reconciledMarks.push({
                            ...existingMark,
                            score: rawMark.score,
                            synced: rawMark.synced || existingMark.synced, // Preserve or update? Parser usually gives synced: false
                            // If parser has explicit value, use it? Or generic update logic?
                            // Default to parser's score.
                            updatedAt: new Date().toISOString(),
                            groupName: groupName // Denormalize groupName
                        });
                    } else {
                        reconciledMarks.push({
                            id: uuidv4(),
                            groupName: groupName, // Denormalize groupName
                            studentId: studentId,
                            taskId: taskId,
                            score: rawMark.score,
                            synced: rawMark.synced || false,
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            });
        });

        return {
            students: resolvedStudents,
            tasks: reconciledTasks,
            marks: reconciledMarks
        };
    }
}
