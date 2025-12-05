
/**
 * Serializes a task object for module storage.
 * Strips unnecessary Vue reactivity or extra properties if needed.
 * @param {Object} task 
 * @returns {Object}
 */
export function serializeTask(task) {
    if (!task) return null;
    return {
        id: task.id,
        name: task.name,
        date: task.date,
        groupName: task.groupName,
        groupId: task.groupId
    };
}

/**
 * Serializes a module object for storage in the repository.
 * Ensures all required properties are present and correctly formatted.
 * @param {Object} module - The module object from the UI
 * @param {Object} group - The selected group object containing name and id
 * @returns {Object} The plain module object ready for storage
 */
export function serializeModule(module, group) {
    if (!module || !group) return null;

    return {
        id: module.id,
        name: module.name,
        tasks: module.tasks ? module.tasks.map(serializeTask) : [],
        test: serializeTask(module.test),
        tasksCoefficient: module.tasksCoefficient,
        testCoefficient: module.testCoefficient,
        minTasksRequired: module.minTasksRequired,
        groupName: group.name,
        groupId: group.id
    };
}
