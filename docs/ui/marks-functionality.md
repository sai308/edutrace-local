# Marks Page Functionality

This document provides a detailed list of available functionalities on the **Marks Page** based on the user interface.

---

## Marks Page

The Marks Page is the central hub for importing, viewing, and managing student marks from various sources. It supports bulk processing, advanced filtering, and flexible grading scales.

### Core Features

#### 1. **File Upload & Import**
- **Drag & Drop Zone**: Large area to drop CSV or Excel files containing marks.
- **Queue Processing**: Handles multiple files dropped at once, processing them sequentially.
- **Validation**: Checks file format and content before processing.
- **Smart Group Detection**:
  - Automatically detects group name from filename (e.g., "KI-301_Marks.csv").
  - If the group exists, marks are imported automatically.
  - If the group does not exist, a **Create Group Modal** appears, pre-filled with the detected name.

#### 2. **Marks Table**

##### **Table Structure**
- **Selection**: Checkboxes for individual or bulk selection.
- **Responsive**: Horizontal scroll on small screens.
- **Animated Rows**: Staggered fade-in for better UX.
- **Empty States**: Helpful messages when no marks exist or no matches found.

##### **Columns**
- **Added**: Date and time of import (Sortable).
- **Student**: Student name (Sortable).
- **Group**: Group name badge (Sortable, Clickable to filter).
- **Task**: Task name and date (Sortable).
- **Mark**: The score/grade (Display depends on selected format).
- **Actions**: Quick actions for each mark.

#### 3. **Grading Scale Formats**
A dropdown menu allows switching the display format of all marks in the table without altering the underlying data:
- **Default (Raw)**: Shows the raw score (e.g., "45/50").
- **5-Point Scale**: Converts to standard 1-5 scale (e.g., "5", "4", "3").
- **100-Point Scale**: Converts to percentage (e.g., "90%").
- **ECTS**: Converts to A-F scale (e.g., "A", "B", "C").

**Tooltips**: Hovering over any mark shows a detailed breakdown of the score and max points.

#### 4. **Search & Filtering**
- **Search Bar**: Real-time search across Student Name, Group Name, and Task Name.
- **Quick Group Filter**: Click any group badge in the table to instantly filter by that group.
- **Advanced Filters Modal**:
  - **Group**: Select specific group or "All".
  - **Status**: Filter by "All" or "Unsynced" (useful for finding new marks).
  - **Date From**: Filter marks added after a specific date.
- **Active Filter Indicators**:
  - Filter button changes color when active.
  - Badge shows count of active filters.

#### 5. **Sync Status Management**
- **Visual Indicators**:
  - **Unsynced**: Orange pulsing dot next to the mark.
  - **Synced**: No dot.
- **Toggle Sync**: Click the checkmark/circle icon in the actions column to toggle status.
  - Useful for tracking which marks have been transferred to the official register.

#### 6. **Deletion**
- **Single Delete**: Trash icon for individual marks.
- **Bulk Delete**:
  - Select multiple marks via checkboxes.
  - "Delete (Count)" button appears in header.
  - Confirmation modal prevents accidental data loss.

#### 7. **Group Creation Modal**
Triggered during file upload if the group doesn't exist.
- **Pre-filled Data**: Name extracted from filename.
- **Fields**: Name, Course, Meet ID, Teacher.
- **Autocomplete**: Suggestions for Meet ID and Teacher.
- **Smart Paste**: Auto-extract Meet ID from URLs.

---

## Data Processing

### File Parsing
- Supports specific CSV/Excel structures.
- Validates required columns (Student, Task, Mark, etc.).
- Skips invalid rows or files with errors.

### Mark Normalization
- Stores marks with `score` and `maxPoints`.
- Calculates percentages for uniform sorting and formatting.

---

## User Workflows

1. **Importing Marks**
   - Drag and drop a file (e.g., "GroupA_Test1.csv").
   - If "GroupA" exists, marks appear instantly.
   - If not, confirm group details in the popup modal.

2. **Reviewing New Marks**
   - Open Filter Modal.
   - Select Status: "Unsynced".
   - Review the filtered list of new marks.

3. **Transferring to Register**
   - Open official register in another window.
   - Copy mark from app.
   - Click "Mark as Synced" (Check icon) in the app.
   - The orange dot disappears, indicating completion.

4. **Analyzing Performance**
   - Switch Grade Scale to "5-Point" or "ECTS" to see standardized grades.
   - Sort by "Mark" to see top/bottom performers.
