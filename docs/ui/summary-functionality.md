# Summary Page Functionality

The **Summary Page** (accessible via `/summary`) is the central hub for managing final assessments, calculating grades based on module performance, and generating official documents. It aggregates data from tasks, attendance, and manual inputs to determine student eligibility and final grades.

## Overview

The page is divided into three main views, switchable via the top-right toggle:
1.  **List**: The primary view for grading and status monitoring.
2.  **Modules**: Configuration view for defining the grading structure (modules, weights, tasks).
3.  **Documents**: A view for managing finalized assessments and their synchronization status.

## Global Controls & State

The following controls affect all views (or specific views where applicable) and are synchronized with the URL query parameters to allow for link sharing and state persistence.

### URL Synchronization
-   **`group`**: The currently selected target group (e.g., `?group=sai308`).
-   **`view`**: The active view mode (`list`, `modules`, `documents`).
-   **`search`**: (List View only) The current search query for filtering students.

### Global Settings
These settings are persisted in the browser's local storage (via `repository.saveExamSettings`) and restored on load:
-   **Target Group**: The group of students being evaluated.
-   **Assessment Type**: `Examination` or `Credit`. Determines the label of the final grade column.
-   **Grade Scale**: `5-scale`, `100-scale`, or `ECTS`. Affects how grades are displayed.
-   **Thresholds**:
    -   **Required Tasks**: Minimum number of regular tasks a student must complete.
    -   **Completion %**: Minimum percentage of tasks required to be "Allowed".
    -   **Attendance %**: Minimum attendance percentage required to be "Allowed".

## 1. List View (`ExamStudentList.vue`)

This view displays a table of students with their calculated metrics, module grades, and final status.

### Data Logic (`useExamData.js`)

The core logic is handled by the `useExamData` composable, which performs the following calculations:

#### 1. Attendance Calculation
-   **Meet Duration**: Calculated as the median duration of participants in a meet, filtering out outliers (2x median).
-   **Student Attendance**: Sum of time a student spent in meets divided by the total possible duration of valid meets.
-   **Threshold**: If `Attendance Enabled` is checked, students below the threshold are marked as "Not Allowed".

#### 2. Module Grades
Modules are defined in the **Modules View**. For each module:
-   **Tasks**: A set of regular tasks.
-   **Test**: A mandatory test task.
-   **Calculation**:
    ```
    Module Grade = (Avg(Task Marks) * TaskCoeff + Test Mark * TestCoeff) / (TaskCoeff + TestCoeff)
    ```
-   **Requirements**: A module is considered "Complete" only if:
    1.  The Test task has a grade.
    2.  The number of completed regular tasks >= `Min Tasks Required`.
-   **Automatic Eligibility**: If *any* module is incomplete, the student is **not** eligible for an "Automatic" grade.

#### 3. Student Status
A student can have one of three statuses:
-   **Automatic** (Blue):
    -   All modules are complete.
    -   The calculated Total Grade is available.
    -   *Note*: Attendance is NOT checked for Automatic status (excellence overrides attendance).
-   **Allowed** (Green):
    -   Not Automatic.
    -   **Completion %** >= Threshold.
    -   **Attendance %** >= Threshold (if enabled).
-   **Not Allowed** (Red):
    -   Fails either completion or attendance criteria.
    -   Tooltip provides specific reasons (e.g., "Attendance: 45% < 60%").

#### 4. Final Grade Determination
The "Exam Grade" column displays the final result:
1.  **Manual Grade**: If a grade has been manually set (via the Action Menu), it takes precedence.
2.  **Existing Assessment**: If a final assessment exists in the database, it is shown.
3.  **Automatic Grade**: If the student has "Automatic" status, their calculated Total Grade is shown in gray (as a suggestion).
4.  **Empty**: Otherwise, shows `-`.

### User Interactions
-   **Sorting**: Click on column headers to sort by Name, Module Grades, Total, Completion, Attendance, Status, or Final Grade.
-   **Search**: Filter students by name.
-   **Action Menu** (Three dots):
    -   **Apply Auto**: Saves the calculated Total Grade as the Final Grade (only for Automatic students).
    -   **Set Manual**: Opens a modal to manually enter a grade.
    -   **Save**: (If unsaved changes exist) Commits the manual grade to the database.
    -   **Remove**: Deletes the stored final assessment.

## 2. Modules View (`ExamConfiguration.vue`)

This view allows instructors to define the structure of the course for grading.

### Module Configuration
Each module consists of:
-   **Name**: Display name (e.g., "Module 1").
-   **Test Task**: A specific task selected from the group's history that serves as the exam/test for this module.
-   **Regular Tasks**: A list of tasks contributing to the module's "Tasks" portion.
-   **Coefficients**: Weights for `Test` vs `Tasks` (e.g., 0.6 / 0.4).
-   **Min Tasks**: Minimum number of regular tasks required to pass the module.

### Logic & Constraints
-   **Task Uniqueness**: A task cannot be used in multiple modules. The UI filters out tasks already assigned to other modules.
-   **Persistence**: Changes are auto-saved (debounced by 500ms) to the `modules` collection in the database.
-   **Drag & Drop**: Modules can be reordered.

## 3. Documents View (`DocumentsList.vue`)

This view lists all **finalized** assessments (grades that have been saved to the database). It is used for generating official reports.

### Features
-   **Display**: Shows Student Name, Final Grade (in 5-scale / 100-scale / ECTS formats), Assessment Type, and timestamps.
-   **Sync Status**:
    -   **Synced At**: Indicates when the grade was synced to an external system (e.g., Dean's office). Click the checkmark to toggle.
    -   **Documented At**: Indicates when the grade was included in a generated document. Click the file icon to toggle.
-   **Filtering**: Only shows assessments for the currently selected group and assessment type.

### Grade Formatting
The Documents view automatically converts the stored grade into all three formats for reference:
-   **5-scale**: Standard 1-5 scale.
-   **100-scale**: Percentage based.
-   **ECTS**: A-F letter grades.

## Data Persistence

-   **Exam Settings**: Stored in `exam_settings` (local storage or user preferences).
-   **Modules**: Stored in `modules` table, linked by `groupName`.
-   **Final Assessments**: Stored in `final_assessments` table. Contains the student ID, grade, type, and timestamps.
