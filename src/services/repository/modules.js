// modules.js
import { getDb } from './db';

/**
 * Save a module (create or update)
 * @param {Object} module - The module object to save
 * @returns {Promise<number>} - The ID of the saved module
 */
export async function saveModule(module) {
    const db = await getDb();
    return db.put('modules', module);
}

/**
 * Get all modules
 * @returns {Promise<Array>} - Array of all modules
 */
export async function getAllModules() {
    const db = await getDb();
    return db.getAll('modules');
}

/**
 * Get modules by group name
 * @param {string} groupName - The name of the group
 * @returns {Promise<Array>} - Array of modules for the group
 */
export async function getModulesByGroup(groupName) {
    const db = await getDb();
    return db.getAllFromIndex('modules', 'groupName', groupName);
}

/**
 * Get a module by ID
 * @param {number} id - The ID of the module
 * @returns {Promise<Object|undefined>} - The module object or undefined
 */
export async function getModuleById(id) {
    const db = await getDb();
    return db.get('modules', id);
}

/**
 * Delete a module by ID
 * @param {number} id - The ID of the module to delete
 * @returns {Promise<void>}
 */
export async function deleteModule(id) {
    const db = await getDb();
    return db.delete('modules', id);
}
