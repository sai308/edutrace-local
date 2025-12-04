# Summary Page Business Logic & Rules

This document details the business logic, data relations, and calculation formulas used in the Summary page of the Edutrace application. It serves as the source of truth for how student performance is evaluated.

## 1. Data Entities & Relations

The system operates on the following core entities:

*   **Group**: A collection of students (Members).
*   **Student (Member)**: An individual being evaluated.
*   **Task**: A specific activity (e.g., "Lab 1", "Test 2") assigned to a group.
*   **Mark**: A score achieved by a student on a specific task.
    *   *Relation*: `Mark` belongs to `Student` and `Task`.
*   **Meet**: A Google Meet session record containing participant duration data.
*   **Module**: A logical grouping of tasks defined for grading purposes.
    *   *Composition*: 1 Test Task + N Regular Tasks.
    *   *Scope*: Defined per Group.
*   **Final Assessment**: A persisted final grade for a student.
    *   *Relation*: One-to-one with `Student` per `AssessmentType`.

## 2. Attendance Logic

Attendance is calculated based on time spent in Google Meets relative to the meeting's effective duration.

### 2.1. Meet Duration Calculation
For each meeting, the "Effective Duration" is calculated to exclude outliers (e.g., someone staying in the call for hours after it ends).

1.  **Collect Durations**: List all participant durations.
2.  **Calculate Median**: Find the median duration of all participants.
3.  **Filter Outliers**:
    *   `Threshold = Median * 2`
    *   Any duration > `Threshold` is ignored for the max calculation.
4.  **Determine Duration**: The maximum duration among the valid (non-outlier) participants is the `Meet Duration`.
5.  **Limit**: The duration is capped by the global `Duration Limit` setting (if > 0).

### 2.2. Student Attendance Percentage
1.  **Possible Duration**: Sum of `Meet Duration` for all meets the group held.
2.  **Attended Duration**: Sum of the student's duration in those meets.
3.  **Percentage**:
    $$
    Attendance \% = \left( \frac{\text{Attended Duration}}{\text{Possible Duration}} \right) \times 100
    $$

## 3. Module Grade Logic

A module's grade is a weighted average of its components.

### 3.1. Components
*   **Test Mark**: The score on the designated "Test Task".
*   **Tasks Mark**: The average score of all other "Regular Tasks" in the module.

### 3.2. Eligibility
A module is considered **Valid/Complete** for a student only if:
1.  The student has a mark for the **Test Task**.
2.  The count of completed Regular Tasks $\ge$ `MinTasksRequired` (defined in Module config).

*If a module is incomplete, it does not generate a grade and disqualifies the student from "Automatic" status.*

### 3.3. Calculation Formula
$$
\text{AvgTaskMark} = \frac{\sum \text{Regular Task Marks}}{\text{Count of Regular Tasks}}
$$

$$
\text{ModuleGrade} = \frac{(\text{AvgTaskMark} \times K_{tasks}) + (\text{TestMark} \times K_{test})}{K_{tasks} + K_{test}}
$$

Where:
*   $K_{tasks}$ = Tasks Coefficient (default 0.5)
*   $K_{test}$ = Test Coefficient (default 0.5)

## 4. Student Status Logic

The student's status determines their eligibility for the exam or automatic grading.

### 4.1. Status Types
1.  **Automatic** (`automatic`): Eligible for an automatic final grade without taking the exam.
2.  **Allowed** (`allowed`): Admitted to the exam.
3.  **Not Allowed** (`notAllowed`): Barred from the exam due to poor performance or attendance.

### 4.2. Determination Rules

**Check 1: Automatic Candidate?**
*   **Condition**: All defined modules are **Valid/Complete** (see 3.2).
*   **Result**: If True, calculate `Total Grade` (average of Module Grades). If False, student is NOT Automatic.

**Check 2: Status Assignment**
*   **IF** `Automatic Candidate` is True **AND** `Total Grade` is valid:
    *   $\rightarrow$ **Status: Automatic**
    *   *(Note: Attendance is ignored for Automatic status)*
*   **ELSE IF**:
    *   `Completion %` $\ge$ `Completion Threshold`
    *   **AND**
    *   (`Attendance Enabled` is False **OR** `Attendance %` $\ge$ `Attendance Threshold`)
    *   $\rightarrow$ **Status: Allowed**
*   **ELSE**:
    *   $\rightarrow$ **Status: Not Allowed**

### 4.3. Completion Metric
*   **Global Completion**:
    $$
    \text{Completion \%} = \left( \frac{\text{Count of Unique Completed Regular Tasks}}{\text{Total Regular Tasks in Group}} \right) \times 100
    $$
    *   *Note*: "Regular Tasks" excludes tasks designated as Tests in any module.

## 5. Grade Conversion Rules

Grades are stored internally as raw numbers or strings but are presented in three standard formats.

### 5.1. 5-Scale (Standard)
Based on percentage (0-100):

| Percentage Range | Grade |
| :--- | :--- |
| 90 - 100 | **5** |
| 75 - 89 | **4** |
| 60 - 74 | **3** |
| 35 - 59 | **2** |
| 0 - 34 | **1** |

### 5.2. ECTS (European)
Based on percentage (0-100):

| Percentage Range | Grade |
| :--- | :--- |
| 90 - 100 | **A** |
| 82 - 89 | **B** |
| 75 - 81 | **C** |
| 67 - 74 | **D** |
| 60 - 66 | **E** |
| 35 - 59 | **FX** |
| 0 - 34 | **F** |

### 5.3. 100-Scale
*   Simply the rounded integer percentage.

## 6. Final Assessment Persistence

When a grade is finalized (saved):
1.  **Source**: Either manually entered or applied from the "Automatic" calculation.
2.  **Storage**: Saved to `final_assessments` table.
3.  **Metadata**:
    *   `studentId`: Link to student.
    *   `assessmentType`: 'examination' or 'credit'.
    *   `grade`: The value.
    *   `gradeFormat`: The scale used (e.g., '5-scale').
    *   `isAutomatic`: Boolean flag (true if applied from auto-grade).
    *   `createdAt`: Timestamp.
