# Repository Service Documentation

## Overview

The `repository` service is the core data access layer for the EduTrace application. It has been refactored into a modular architecture to improve maintainability. The main `index.js` acts as a facade, delegating operations to specialized sub-modules.

**File Location**: `src/services/repository/` (Directory)
**Entry Point**: [index.js](file:///home/sai/Projects/AI/edutrace/src/services/repository/index.js)

**Database Technology**: IndexedDB (via `idb` library)  
**Current DB Version**: 9  
**Default Database Name**: `meet-attendance-db`

---

## Architecture

### Modular Structure

The service is split into the following modules:

- **`index.js`**: Public facade.
- **`db.js`**: DB connection and schema management.
- **`workspace.js`**: Workspace CRUD and switching.
- **`settings.js`**: LocalStorage settings.
- **`meets.js`**: Attendance reports.
- **`groups.js`**: Student groups.
- **`members.js`**: Students and teachers.
- **`tasks.js`**: Assignments.
- **`marks.js`**: Grades.
- **`backup.js`**: Import/Export logic.
- **`stats.js`**: Statistics and size calculations.

### Multi-Workspace System

The repository implements a workspace-based architecture where each workspace has its own IndexedDB database:

- **Workspace Metadata**: Stored in localStorage under `edutrace_workspaces`
- **Current Workspace**: Tracked in localStorage under `edutrace_current_workspace`
- **Dynamic DB Connection**: The database connection is cached and automatically switches when the workspace changes

### Database Schema

The database contains the following object stores:

#### 1. **meets** (Reports/Attendance Records)
- **Primary Key**: `id`
- **Indexes**:
  - `meetId` (non-unique) - Google Meet ID
  - `date` (non-unique) - Date of the meeting
- **Purpose**: Stores attendance reports from Google Meet CSV files

#### 2. **groups** (Student Groups/Classes)
- **Primary Key**: `id`
- **Indexes**:
  - `meetId` (unique) - Links to Google Meet ID
  - `name` (unique) - Group name
- **Purpose**: Stores group/class information
- **Fields**: `id`, `name`, `meetId`, `course` (1-4)

#### 3. **tasks** (Assignments/Assessments)
- **Primary Key**: `id` (auto-increment)
- **Indexes**:
  - `groupId` (non-unique)
  - `name_date_group` (unique composite) - Natural key
  - `groupName` (non-unique)
- **Purpose**: Stores tasks/assignments for grading
- **Natural Key**: `name` + `date` + `groupName`

#### 4. **marks** (Grades/Scores)
- **Primary Key**: `id` (auto-increment)
- **Indexes**:
  - `taskId` (non-unique)
  - `studentId` (non-unique)
  - `task_student` (unique composite) - Ensures one mark per student per task
  - `createdAt` (non-unique)
- **Purpose**: Stores student grades for tasks

#### 5. **members** (Students and Teachers)
- **Primary Key**: `id` (auto-increment)
- **Indexes**:
  - `name` (unique) - For merging and deduplication
  - `groupName` (non-unique)
  - `role` (non-unique) - 'student' or 'teacher'
- **Purpose**: Unified entity for all participants (students and teachers)
- **Fields**: `id`, `name`, `groupName`, `email`, `role`, `aliases[]`, `hidden`

#### 6. **settings**
- **Primary Key**: `key`
- **Purpose**: Stores miscellaneous settings (currently unused, settings are in localStorage)

---

## API Reference

### Workspace Management

#### `getWorkspaces()`
Returns all available workspaces.

**Returns**: `Array<Workspace>`
```javascript
{
  id: string,
  name: string,
  dbName: string,
  icon?: string,
  createdAt: string,
  updatedAt?: string
}
```

#### `getCurrentWorkspaceId()`
Returns the ID of the currently active workspace.

**Returns**: `string`

#### `createWorkspace(name, options)`
Creates a new workspace.

**Parameters**:
- `name` (string): Workspace name
- `options` (object):
  - `icon` (string): Icon name (default: 'Database')
  - `exportSettings` (boolean): Copy settings from current workspace

**Returns**: `Promise<string>` - New workspace ID

#### `updateWorkspace(id, updates)`
Updates workspace metadata (name, icon, etc.).

**Parameters**:
- `id` (string): Workspace ID
- `updates` (object): Fields to update

**Returns**: `Promise<Workspace>`

**Note**: Cannot update `id` or `dbName` fields

#### `switchWorkspace(id)`
Switches to a different workspace and reloads the application.

**Parameters**:
- `id` (string): Target workspace ID

**Side Effects**: Triggers page reload with fade transition

#### `deleteWorkspace(id)`
Permanently deletes a workspace and its database.

**Parameters**:
- `id` (string): Workspace ID

**Restrictions**: Cannot delete the 'default' workspace

#### `exportWorkspaces(workspaceIds)`
Exports multiple workspaces to a backup file.

**Parameters**:
- `workspaceIds` (Array<string>): IDs of workspaces to export

**Returns**: `Promise<Object>` - Multi-workspace backup data
```javascript
{
  type: 'multi-workspace-backup',
  version: 1,
  timestamp: string,
  workspaces: [
    {
      id: string,
      name: string,
      icon: string,
      dbName: string,
      data: { meets, groups, tasks, marks, members }
    }
  ]
}
```

#### `importWorkspaces(data, selectedIds)`
Imports workspaces from a backup file.

**Parameters**:
- `data` (object): Multi-workspace backup data
- `selectedIds` (Array<string>): IDs of workspaces to import

**Side Effects**: Creates new workspace entries and restores data

#### `deleteWorkspacesData(workspaceIds)`
Clears all data from specified workspaces without deleting the workspace itself.

**Parameters**:
- `workspaceIds` (Array<string>): IDs of workspaces to clear

---

### Reports/Meets (Attendance Data)

#### `saveMeet(meetData)`
Saves or updates a meeting/attendance report.

**Parameters**:
- `meetData` (object): Meeting data with `id`, `meetId`, `date`, `participants[]`, etc.

**Returns**: `Promise<IDBValidKey>`

#### `getAllMeets()`
Retrieves all meeting reports in the current workspace.

**Returns**: `Promise<Array<Meet>>`

#### `getMeetsByMeetId(meetId)`
Retrieves all meetings for a specific Google Meet ID.

**Parameters**:
- `meetId` (string): Google Meet ID

**Returns**: `Promise<Array<Meet>>`

#### `getMeetById(id)`
Retrieves a single meeting by its primary key.

**Parameters**:
- `id` (string): Meeting record ID

**Returns**: `Promise<Meet>`

#### `checkMeetExists(meetId, date)`
Checks if a meeting already exists for a given Meet ID and date.

**Parameters**:
- `meetId` (string): Google Meet ID
- `date` (string): Meeting date

**Returns**: `Promise<boolean>`

#### `isDuplicateFile(filename, meetId, date)`
Checks if a file has already been imported.

**Parameters**:
- `filename` (string): CSV filename
- `meetId` (string): Google Meet ID
- `date` (string): Meeting date

**Returns**: `Promise<boolean>`

#### `deleteMeet(id)`
Deletes a single meeting record.

**Parameters**:
- `id` (string): Meeting record ID

**Returns**: `Promise<void>`

#### `deleteMeets(ids)`
Deletes multiple meeting records in a single transaction.

**Parameters**:
- `ids` (Array<string>): Meeting record IDs

**Returns**: `Promise<void>`

---

### Groups (Classes/Student Groups)

#### `getGroups()`
Retrieves all groups in the current workspace.

**Returns**: `Promise<Array<Group>>`

#### `saveGroup(group)`
Saves or updates a group and syncs members from associated meetings.

**Parameters**:
- `group` (object): Group data with `id`, `name`, `meetId`, `course`

**Returns**: `Promise<string>` - Group ID

**Side Effects**: Automatically syncs members from meetings if `meetId` is present

#### `deleteGroup(id)`
Deletes a group.

**Parameters**:
- `id` (string): Group ID

**Returns**: `Promise<void>`

#### `getGroupMap()`
Creates a lookup map of groups indexed by `meetId`.

**Returns**: `Promise<Object>` - `{ [meetId]: Group }`

#### `syncMembersFromMeets(group)`
Syncs members from all meetings associated with a group.

**Parameters**:
- `group` (object): Group with `meetId` and `name`

**Returns**: `Promise<void>`

**Side Effects**: Creates new member records for participants not already in the database

#### `syncAllMembersFromMeets()`
Syncs members from all meetings across all groups.

**Returns**: `Promise<void>`

**Use Case**: Initial data migration or bulk sync

---

### Tasks (Assignments/Assessments)

#### `saveTask(task)`
Saves a new task or returns existing task if duplicate.

**Parameters**:
- `task` (object): Task data with `name`, `date`, `groupName`, `maxPoints`

**Returns**: `Promise<{ id: number, isNew: boolean }>`

**Deduplication**: Uses natural key (`name` + `date` + `groupName`)

#### `getAllTasks()`
Retrieves all tasks in the current workspace.

**Returns**: `Promise<Array<Task>>`

#### `getTasksByGroup(groupName)`
Retrieves all tasks for a specific group.

**Parameters**:
- `groupName` (string): Group name

**Returns**: `Promise<Array<Task>>`

#### `findTaskByNaturalKey(name, date, groupName)`
Finds a task by its natural key.

**Parameters**:
- `name` (string): Task name
- `date` (string): Task date
- `groupName` (string): Group name

**Returns**: `Promise<Task | undefined>`

---

### Marks (Grades/Scores)

#### `saveMark(mark)`
Saves a new mark or updates existing mark if duplicate.

**Parameters**:
- `mark` (object): Mark data with `taskId`, `studentId`, `score`

**Returns**: `Promise<{ id: number, isNew: boolean }>`

**Deduplication**: 
- If mark exists with same score: returns `isNew: false`
- If mark exists with different score: updates and returns `isNew: true`
- If mark doesn't exist: creates and returns `isNew: true`

#### `getMarksByTask(taskId)`
Retrieves all marks for a specific task.

**Parameters**:
- `taskId` (number): Task ID

**Returns**: `Promise<Array<Mark>>`

#### `getMarksByStudent(studentId)`
Retrieves all marks for a specific student.

**Parameters**:
- `studentId` (number): Student/member ID

**Returns**: `Promise<Array<Mark>>`

#### `getAllMarksWithRelations()`
Retrieves all marks with denormalized student and task data.

**Returns**: `Promise<Array<FlatMark>>`
```javascript
{
  id: number,
  studentName: string,
  groupName: string,
  taskName: string,
  taskDate: string,
  maxPoints: number,
  score: number,
  synced: boolean,
  createdAt: string
}
```

**Performance**: Uses in-memory maps for O(1) lookups, optimized for large datasets

#### `updateMarkSynced(id, synced)`
Updates the sync status of a mark.

**Parameters**:
- `id` (number): Mark ID
- `synced` (boolean): Sync status

**Returns**: `Promise<void>`

#### `deleteMark(id)`
Deletes a single mark.

**Parameters**:
- `id` (number): Mark ID

**Returns**: `Promise<void>`

#### `deleteMarks(ids)`
Deletes multiple marks in a single transaction.

**Parameters**:
- `ids` (Array<number>): Mark IDs

**Returns**: `Promise<void>`

---

### Members (Students and Teachers)

#### `saveMember(member)`
Saves or updates a member with automatic role resolution and deduplication.

**Parameters**:
- `member` (object): Member data with `name`, `groupName`, `email`, `role`, `aliases[]`

**Returns**: `Promise<number>` - Member ID

**Deduplication**: 
- Merges by `id` if provided
- Merges by `name` if no `id`
- Auto-resolves role from teachers list if not specified

#### `getAllMembers()`
Retrieves all members in the current workspace.

**Returns**: `Promise<Array<Member>>`

#### `getMembersByGroup(groupName)`
Retrieves all members for a specific group.

**Parameters**:
- `groupName` (string): Group name

**Returns**: `Promise<Array<Member>>`

#### `hideMember(id)`
Marks a member as hidden (soft delete).

**Parameters**:
- `id` (number): Member ID

**Returns**: `Promise<void>`

#### `hideMembers(ids)`
Marks multiple members as hidden.

**Parameters**:
- `ids` (Array<number>): Member IDs

**Returns**: `Promise<void>`

#### `deleteMember(id)`
Permanently deletes a member.

**Parameters**:
- `id` (number): Member ID

**Returns**: `Promise<void>`

#### `deleteMembers(ids)`
Permanently deletes multiple members.

**Parameters**:
- `ids` (Array<number>): Member IDs

**Returns**: `Promise<void>`

#### Legacy Aliases
- `saveStudent(student)` → `saveMember()`
- `getAllStudents()` → `getAllMembers()`
- `getStudentsByGroup(groupName)` → `getMembersByGroup()`

---

### Settings (localStorage-based)

All settings are workspace-scoped and stored in localStorage with workspace-specific keys.

#### `getDurationLimit()`
Gets the maximum meeting duration limit in minutes.

**Returns**: `Promise<number>` - Minutes (0 = no limit)

#### `saveDurationLimit(limit)`
Sets the maximum meeting duration limit.

**Parameters**:
- `limit` (number): Minutes

**Returns**: `Promise<void>`

#### `getDefaultTeacher()`
Gets the default teacher for the workspace.

**Returns**: `Promise<Object | null>` - Teacher object

#### `saveDefaultTeacher(teacher)`
Sets the default teacher.

**Parameters**:
- `teacher` (object): Teacher data

**Returns**: `Promise<void>`

#### `getIgnoredUsers()`
Gets the list of ignored users (excluded from reports).

**Returns**: `Promise<Array<string>>` - User names

#### `saveIgnoredUsers(users)`
Sets the list of ignored users.

**Parameters**:
- `users` (Array<string>): User names

**Returns**: `Promise<void>`

#### `getTeachers()`
Gets the list of teachers.

**Returns**: `Promise<Array<string>>` - Teacher names

#### `saveTeachers(teachers)`
Sets the list of teachers and syncs roles in the database.

**Parameters**:
- `teachers` (Array<string>): Teacher names

**Returns**: `Promise<void>`

**Side Effects**: Updates `role` field for all matching members in the database

---

### Data Import/Export

#### Full Workspace Export/Import

##### `exportData()`
Exports all data from the current workspace.

**Returns**: `Promise<Object>`
```javascript
{
  meets: Array,
  groups: Array,
  tasks: Array,
  marks: Array,
  members: Array,
  settings: {
    ignoredUsers: Array,
    durationLimit: number,
    defaultTeacher: Object
  },
  version: 3,
  timestamp: string
}
```

##### `importData(jsonData)`
Imports data into the current workspace, replacing all existing data.

**Parameters**:
- `jsonData` (object): Export data object

**Returns**: `Promise<void>`

**Side Effects**: 
- Clears all existing data
- Restores all data from backup
- Restores workspace settings (`durationLimit`, `defaultTeacher`, `ignoredUsers`)
- Preserves task IDs using natural key matching

#### Granular Export/Import

##### `exportReports()`
Exports only attendance reports.

**Returns**: `Promise<Object>` - `{ meets, version, type, timestamp }`

##### `exportGroups()`
Exports only groups.

**Returns**: `Promise<Object>` - `{ groups, version, type, timestamp }`

##### `exportMarks()`
Exports marks, tasks, and members.

**Returns**: `Promise<Object>` - `{ tasks, marks, members, version, type, timestamp }`

##### `importReports(jsonData)`
Imports only attendance reports, replacing existing reports.

**Parameters**:
- `jsonData` (object): Reports export data

**Returns**: `Promise<void>`

##### `importGroups(jsonData)`
Imports only groups, replacing existing groups.

**Parameters**:
- `jsonData` (object): Groups export data

**Returns**: `Promise<void>`

##### `importMarks(jsonData)`
Imports marks, tasks, and members, replacing existing data.

**Parameters**:
- `jsonData` (object): Marks export data

**Returns**: `Promise<void>`

**Features**:
- Task ID mapping using natural keys
- Preserves referential integrity

---

### Data Clearing

#### `clearAll()`
Clears all data from the current workspace.

**Returns**: `Promise<void>`

**Side Effects**: 
- Clears all object stores
- Removes workspace-specific settings from localStorage
- Preserves workspace metadata

#### Granular Clear Methods

- `clearReports()` - Clears only meets
- `clearGroups()` - Clears only groups
- `clearMarks()` - Clears tasks and marks
- `clearMembers()` - Clears members
- `clearStudents()` - Legacy alias for `clearMembers()`

---

### Utilities

#### `applyDurationLimitToAll(limitMinutes)`
Applies a duration cap to all meeting participants retroactively.

**Parameters**:
- `limitMinutes` (number): Maximum duration in minutes

**Returns**: `Promise<number>` - Count of modified meetings

**Use Case**: Fixing data where some participants have unrealistically long durations

#### `getEntityCounts()`
Gets record counts for all entity types.

**Returns**: `Promise<Object>`
```javascript
{
  reports: number,
  groups: number,
  marks: number,
  tasks: number,
  members: number
}
```

#### `getEntitySizes()`
Estimates storage size for each entity type.

**Returns**: `Promise<Object>`
```javascript
{
  reports: number,  // bytes
  groups: number,
  marks: number,    // includes tasks
  tasks: number,
  members: number
}
```

**Method**: Uses `JSON.stringify()` + `Blob` size estimation

#### `getAllWorkspacesSizes()`
Calculates storage size for all workspaces.

**Returns**: `Promise<Object>`
```javascript
{
  total: number,
  workspaces: [
    {
      id: string,
      name: string,
      size: number,
      error?: boolean
    }
  ]
}
```

---

## Internal Functions

### `getDb()`
Returns a cached IndexedDB connection for the current workspace.

**Returns**: `Promise<IDBDatabase>`

**Caching**: Connection is cached until workspace changes

**Upgrade Logic**: Handles schema migrations from version 1 to 9

### `_syncParticipants(meets, groupName)`
Internal helper to sync participants from meetings to members.

**Parameters**:
- `meets` (Array): Meeting records
- `groupName` (string): Target group name

**Returns**: `Promise<void>`

---

## Database Migrations

The service handles automatic schema upgrades through IndexedDB's `upgrade` callback:

### Version History

- **v1-v4**: Initial schema development
- **v5**: Introduced `members` store (unified students and teachers)
- **v6**: Added `groupName` index to tasks
- **v7**: Made `meetId` index unique in groups
- **v8**: Added `course` field backfill for groups
- **v9**: Fixed tasks natural key index (`name_date_group`) and removed legacy `students` store

### Migration Strategy

- **Non-destructive**: Production stores are preserved during migration; pre-release legacy stores (e.g., `students`) may be removed in later versions
- **Backfill**: Missing fields are populated from existing data
- **Index upgrades**: Indexes are recreated when uniqueness constraints change

---

## Design Patterns

### 1. **Workspace Isolation**
Each workspace has a separate IndexedDB database, ensuring complete data isolation.

### 2. **Natural Keys**
Tasks use composite natural keys (`name` + `date` + `groupName`) to prevent duplicates during imports.

### 3. **Upsert Pattern**
`saveMark()` and `saveTask()` implement upsert logic, returning metadata about whether a record was created or updated.

### 4. **Soft Deletes**
Members can be hidden rather than deleted, preserving historical data integrity.

### 5. **Batch Operations**
Methods like `deleteMarks()` and `deleteMeets()` use transactions to delete multiple records efficiently.

### 6. **Denormalization for Performance**
`getAllMarksWithRelations()` creates flat records with denormalized data for fast rendering.

### 7. **Role Resolution**
Member roles are automatically resolved from the teachers list when not explicitly provided.

---

## Performance Considerations

### Indexing Strategy
- All foreign keys are indexed for fast lookups
- Composite indexes enable efficient natural key queries
- Unique indexes prevent data duplication

### Transaction Batching
- Bulk operations use single transactions
- Parallel `Promise.all()` for independent reads
- Sequential writes within transactions

### Caching
- Database connection is cached per workspace
- Settings are cached in localStorage for instant access

### Memory Efficiency
- `getAllMarksWithRelations()` uses Maps for O(1) lookups
- Cursor-based iteration for large datasets (e.g., course backfill)

---

## Error Handling

### Common Errors

1. **Unique Constraint Violations**: Thrown when trying to create duplicate groups or tasks
2. **Workspace Not Found**: Thrown when switching to non-existent workspace
3. **Invalid Import Data**: Thrown when import data is missing required fields
4. **Cannot Delete Default Workspace**: Thrown when attempting to delete the default workspace

### Error Recovery

- Settings getters return safe defaults on localStorage errors
- Missing stores are created during upgrade
- Orphaned records are skipped in `getAllMarksWithRelations()`

---

## Usage Examples

### Creating a New Workspace
```javascript
const workspaceId = await repository.createWorkspace('Fall 2024', {
  icon: 'School',
  exportSettings: true
});
```

### Importing Attendance Data
```javascript
const meetData = {
  id: crypto.randomUUID(),
  meetId: 'abc-defg-hij',
  date: '2024-11-29',
  participants: [
    { name: 'John Doe', email: 'john@example.com', duration: 3600 }
  ]
};
await repository.saveMeet(meetData);
```

### Recording a Grade
```javascript
const task = await repository.saveTask({
  name: 'Homework 1',
  date: '2024-11-29',
  groupName: 'CS-101',
  maxPoints: 100
});

await repository.saveMark({
  taskId: task.id,
  studentId: 42,
  score: 85
});
```

### Exporting All Data
```javascript
const backup = await repository.exportData();
const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
// Download blob...
```

---

## Future Enhancements

### Potential Improvements

1. **Offline Sync**: Implement conflict resolution for multi-device usage
2. **Incremental Backups**: Export only changed data since last backup
3. **Data Validation**: Add schema validation for all entities
4. **Audit Trail**: Track all data modifications with timestamps and user info
5. **Archival**: Move old data to separate archive databases
6. **Full-Text Search**: Add search indexes for names and task descriptions

---

## Related Files

Various composables that use this service:
  - `useMarks.js`
  - `useStudents.js`
  - `useGroups.js`
  - And others

---

## Maintenance Notes

---

## Backup Formats

### Full Export (Version 3)
The `exportData` function produces a JSON object with the following structure:
```json
{
  "version": 3,
  "timestamp": "ISO-8601 string",
  "meets": [ ... ],
  "groups": [ ... ],
  "tasks": [ ... ],
  "marks": [ ... ],
  "members": [ ... ],
  "settings": {
    "ignoredUsers": [ ... ],
    "durationLimit": number,
    "defaultTeacher": object
  }
}
```
**Import Logic**:
- Clears all existing data.
- Restores all entities.
- Preserves `tasks` and `marks` relationships by matching natural keys (`name` + `date` + `groupName` for tasks) if IDs conflict, or generating new IDs and remapping marks.

### Granular Exports

#### Reports (Version 1)
```json
{
  "version": 1,
  "type": "reports",
  "timestamp": "ISO-8601 string",
  "meets": [ ... ]
}
```

#### Groups (Version 1)
```json
{
  "version": 1,
  "type": "groups",
  "timestamp": "ISO-8601 string",
  "groups": [ ... ]
}
```

#### Marks (Version 2)
```json
{
  "version": 2,
  "type": "marks",
  "timestamp": "ISO-8601 string",
  "tasks": [ ... ],
  "marks": [ ... ],
  "members": [ ... ]
}
```
**Import Logic**:
- Replaces existing data for the specific entity type.
- Marks import handles task ID remapping similar to full import.

### When Adding New Fields

1. Update the object store schema in `getDb()` upgrade callback
2. Increment `DB_VERSION`
3. Add migration logic for existing records if needed
4. Update TypeScript types (if applicable)
5. Update this documentation

### When Adding New Stores

1. Create store in `getDb()` upgrade callback
2. Add indexes as needed
3. Create CRUD methods following existing patterns
4. Add to export/import methods
5. Add to clear methods
6. Update this documentation
