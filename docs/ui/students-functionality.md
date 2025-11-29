# Students Page Functionality

This document provides a detailed list of available functionalities on the **Students Page** based on the user interface.

---

## Students Page

The Students Page provides a comprehensive view of all students across all groups, allowing for detailed performance tracking, management, and analysis.

### Core Features

#### 1. **Page Header**
- **Title**: "Students" heading
- **Subtitle**: Shows filtered count and total count (e.g., "Showing 25 of 150 students")
- **Bulk Delete Button**: 
  - Appears only when students are selected
  - Shows count of selected students
  - Destructive style (red)
  - Triggers bulk delete confirmation

#### 2. **Search & Filtering**
- **Search Bar**: Full-text search across:
  - Student Name
  - Group Names
  - Meet IDs
- **Group Filter**: 
  - Filter students by clicking on a group badge in the table
  - Active filter shown as a chip in the header
  - Click "X" on chip to remove filter
- **Teacher Filtering**: Teachers are automatically excluded from the main list based on the global teachers list.

#### 3. **Column Management**
- **Column Picker**: Toggle visibility of columns
- **Available Columns**:
  - **Name** (default visible): Student name
  - **Groups** (default visible): Associated groups
  - **Meet IDs** (hidden by default): Associated meet IDs
  - **Sessions** (default visible): Attendance count
  - **Avg %** (default visible): Average attendance duration percentage
  - **Total %** (default visible): Total attendance duration percentage
  - **Avg ★** (default visible): Average mark (5-point scale)
  - **Total ✓** (default visible): Task completion percentage
- **Reset Columns**: Restore default column visibility
- **Persistent State**: Column preferences saved to localStorage

#### 4. **Sorting**
- **Sortable Columns**: All data columns
- **Sort Indicators**: Arrow icons showing current sort direction
- **Default Sort**: Name ascending
- **URL Sync**: Sort state persisted in URL query parameters

#### 5. **Students Table**

##### **Table Structure**
- **Selection Checkboxes**: 
  - Header checkbox for "Select All" (visible students only)
  - Row checkboxes for individual selection
  - Used for bulk deletion
- **Responsive**: Horizontal scroll on small screens
- **Hover Effects**: Row highlights on hover
- **Animated Rows**: Staggered fade-in animation

##### **Column Details**

1. **# Column**
   - Row number index

2. **Name Column**
   - Student display name
   - Bold font weight

3. **Groups Column**
   - List of groups the student belongs to
   - Displayed as clickable badges
   - **Interaction**: Click badge to filter table by that group
   - Highlighted if currently selected filter

4. **Meet IDs Column** (Hidden by default)
   - List of meet IDs associated with the student
   - Displayed as clickable badges
   - **Interaction**: Click badge to navigate to Analytics Details for that meet ID

5. **Sessions Column**
   - Format: "Attended / Total"
   - Shows participation rate

6. **Avg Time % Column**
   - Average attendance percentage across attended sessions
   - **Color Coding**:
     - Green: ≥75%
     - Yellow: 50-74%
     - Red: <50%
   - Tooltip: "Across X sessions"

7. **Total Time % Column**
   - Total attendance percentage relative to total possible duration
   - **Color Coding**: Same as Avg Time
   - Tooltip: Formatted total duration (e.g., "10h 30m")

8. **Avg Mark ★ Column**
   - Average grade on 5-point scale
   - **Color Coding**:
     - Green: 5
     - Blue: 4
     - Yellow: 3
     - Orange: 2
     - Red: 1
   - Tooltip: Detailed score info (e.g., "Average grade: 4.5/5 (based on 10 marks)")
   - Displays "—" if no marks

9. **Total Completion ✓ Column**
   - Percentage of completed tasks
   - **Color Coding**: Standard green/yellow/red scale
   - Tooltip: "X / Y tasks"

10. **Actions Column**
    - **Profile Button**: User icon, opens detailed Student Profile Modal
    - **Edit Button**: Pencil icon, opens Edit Student Modal
    - **Delete Button**: Trash icon, opens delete confirmation

#### 6. **Student Profile Modal**

A comprehensive dashboard for an individual student.

##### **Header**
- Student Name & Email
- **Email Actions**:
  - Mailto link (opens default mail client)
  - Copy email to clipboard (with success feedback)
- Close button

##### **View Modes**
Toggle between two main views:

###### **A. Attendance View**
- **Bar Chart**: Duration (hours) per session date
- **Stats Cards**:
  - Attended Sessions (Count / Total)
  - Average Attendance %
  - Total Time (Formatted duration)
- **Attendance History Table**:
  - Date & Group
  - Meet ID
  - Duration
  - **Progress Bar**: Visual timeline of attendance
    - Shows join time offset
    - Shows duration length
    - Color-coded by percentage
    - Tooltip with exact join time
  - Status % badge

###### **B. Marks View**
- **Charts**:
  - **Grade Distribution**: Pie chart of grades (1-5)
  - **Task Completion**: Pie chart of Completed vs Pending
- **Stats Cards**:
  - Average Grade
  - Tasks Completed (Count / Total)
  - Completion %
- **Marks History Table**:
  - Date
  - Task Name
  - Score (Score / Max Points)
  - Grade (1-5 scale, color-coded)

#### 7. **Edit Student Modal**
- **Fields**:
  - **Name**: Text input
  - **Groups**: Text input with datalist suggestions from existing groups
  - **Email**: Email input
- **Actions**: Save or Cancel

#### 8. **Delete Functionality**
- **Single Delete**: Delete one student
- **Bulk Delete**: Delete multiple selected students
- **Confirmation Modal**:
  - Context-aware message (single vs bulk count)
  - Destructive action button

---

## Data Calculations

### Attendance Metrics
- **Avg Time %**: Average of (Student Duration / Session Duration) for all attended sessions.
- **Total Time %**: (Total Student Duration / Total Duration of All Sessions) * 100.
- **Session Duration Logic**: Calculated dynamically based on median participant duration to handle "infinite" meetings or outliers.

### Marks Metrics
- **Avg Mark**: Mean of all assigned marks, converted to 5-point scale.
- **Completion**: (Completed Tasks / Total Tasks) * 100.

---

## User Workflows

1. **Analyze Student Performance**
   - Open Students page
   - Sort by "Avg Mark" or "Avg Time" to find top/bottom performers
   - Click Profile icon to view detailed charts

2. **Manage Student Data**
   - Edit student name or group assignment via Edit modal
   - Delete duplicate or invalid students
   - Bulk delete old students

3. **Navigate to Analytics**
   - Enable "Meet IDs" column
   - Click a meet ID badge to jump to the Analytics page for that specific meeting series

4. **Filter by Group**
   - Click a group badge in the table to focus on one class
   - Use search bar to refine further
