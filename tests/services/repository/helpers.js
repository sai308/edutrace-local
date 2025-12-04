/**
 * Test fixture helpers for creating consistent test data
 */

let idCounter = 1;

/**
 * Reset the ID counter (useful for beforeEach)
 */
export function resetIdCounter() {
    idCounter = 1;
}

/**
 * Generate a unique ID
 */
function generateId() {
    return idCounter++;
}

/**
 * Create a meet fixture with optional overrides
 */
export function createMeetFixture(overrides = {}) {
    return {
        id: generateId(),
        meetId: `meet-${Date.now()}`,
        date: '2024-01-15',
        filename: `attendance-${Date.now()}.csv`,
        participants: [
            { name: 'John Doe', email: 'john@example.com', duration: 3600 },
            { name: 'Jane Smith', email: 'jane@example.com', duration: 3000 },
        ],
        ...overrides,
    };
}

/**
 * Create a group fixture with optional overrides
 */
export function createGroupFixture(overrides = {}) {
    const id = generateId();
    return {
        id,
        name: 'KH-41',
        meetId: `meet-${Date.now()}-${id}`,
        course: 'K',
        ...overrides,
    };
}

/**
 * Create a member fixture with optional overrides
 */
export function createMemberFixture(overrides = {}) {
    return {
        id: generateId(),
        name: 'Student Name',
        email: 'student@example.com',
        groupName: 'KH-41',
        role: 'student',
        hidden: false,
        aliases: [],
        ...overrides,
    };
}

/**
 * Create a task fixture with optional overrides
 */
export function createTaskFixture(overrides = {}) {
    return {
        name: 'Lab 1',
        date: '2024-01-15',
        groupName: 'KH-41',
        maxPoints: 10,
        ...overrides,
    };
}

/**
 * Create a mark fixture with optional overrides
 */
export function createMarkFixture(overrides = {}) {
    return {
        taskId: 1,
        studentId: 1,
        score: 10,
        ...overrides,
    };
}

/**
 * Create a module fixture with optional overrides
 */
export function createModuleFixture(overrides = {}) {
    return {
        ordinal: 1,
        name: 'Module 1',
        groupName: 'KH-41',
        test: { name: 'Test 1', date: '2024-01-20' },
        tasks: [
            { name: 'Lab 1', date: '2024-01-15' },
            { name: 'Lab 2', date: '2024-01-18' }
        ],
        testCoeff: 0.6,
        taskCoeff: 0.4,
        ...overrides,
    };
}

/**
 * Create a final assessment fixture with optional overrides
 */
export function createFinalAssessmentFixture(overrides = {}) {
    return {
        studentId: 1,
        groupName: 'KH-41',
        assessmentType: 'examination',
        grade5: 5,
        grade100: 95,
        gradeECTS: 'A',
        isAutomatic: false,
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}


/**
 * Create multiple fixtures at once
 */
export function createFixtures(type, count, overridesFn = () => ({})) {
    const fixtures = [];
    const creators = {
        meet: createMeetFixture,
        group: createGroupFixture,
        member: createMemberFixture,
        task: createTaskFixture,
        mark: createMarkFixture,
        module: createModuleFixture,
        finalAssessment: createFinalAssessmentFixture,
    };

    const creator = creators[type];
    if (!creator) {
        throw new Error(`Unknown fixture type: ${type}`);
    }

    for (let i = 0; i < count; i++) {
        fixtures.push(creator(overridesFn(i)));
    }

    return fixtures;
}
