/**
 * @typedef {Object} Meet
 * @property {string} id
 * @property {string} meetId
 * @property {string} date
 * @property {string} [filename]
 * @property {Array<{ name: string, email?: string, duration: number }>} participants
 */

/**
 * @typedef {Object} Group
 * @property {string} id
 * @property {string} name
 * @property {string} meetId
 * @property {number} [course]
 */

/**
 * @typedef {Object} Member
 * @property {number} id
 * @property {string} name
 * @property {string} groupName
 * @property {string} role  // 'student' | 'teacher'
 * @property {string[]} [aliases]
 * @property {boolean} [hidden]
 * @property {string} [email]
 */

/**
 * @typedef {Object} Task
 * @property {number} id
 * @property {string} name
 * @property {string} date
 * @property {string} groupName
 * @property {number} [maxPoints]
 * @property {string} [groupId]
 */

/**
 * @typedef {Object} Mark
 * @property {number} id
 * @property {number} taskId
 * @property {number} studentId
 * @property {number} score
 * @property {string} createdAt
 * @property {boolean} [synced]
 */

export { };
