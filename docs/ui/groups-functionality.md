# Groups Page Functionality

This document provides a detailed list of available functionalities on the **Groups Page** based on the user interface.

---

## Groups Page

The Groups Page allows you to manage meeting groups, associating meetIds with group names, teachers, and course levels. It also displays aggregated statistics for each group.

### Core Features

#### 1. **Page Header**
- **Title**: "Groups" heading
- **Subtitle**: Shows filtered count and total count (e.g., "5 of 10 groups")
- **Add Group Button**: Primary action button to create new group
  - Icon: Plus icon
  - Position: Top-right
  - Full-width on mobile, auto-width on desktop

#### 2. **Search Functionality**
- **Search Bar**: Full-text search across groups
- **Search Scope**: Searches through:
  - Group name
  - Meet ID
- **Real-time Filtering**: Results update as you type
- **URL Sync**: Search query persisted in URL parameters
- **Search Icon**: Visual indicator in search input

#### 3. **Column Management**
- **Column Picker**: Toggle visibility of columns
- **Available Columns**:
  - **Name** (default visible): Group name
  - **Course** (default visible): Course level (1-4)
  - **Meet ID** (default visible): Associated Google Meet ID
  - **Members** (default visible): Number of students in group
  - **Teacher** (default visible): Teacher name
  - **Avg Completion** (default visible): Average task completion percentage
  - **Avg Mark** (default visible): Average mark (5-point scale)
  - **Mode Mark** (hidden by default): Most frequent mark
  - **Median Mark** (hidden by default): Median mark
- **Reset Columns**: Restore default column visibility
- **Persistent State**: Column preferences saved to localStorage

#### 4. **Sorting**
- **Sortable Columns**: All columns except Actions
- **Sort Indicators**: Arrow icons showing current sort direction
  - ArrowUp: Ascending
  - ArrowDown: Descending
  - ArrowUpDown (faded): Not currently sorted
- **Toggle Sort**: Click column header to cycle through asc/desc
- **Default Sort**: Name ascending (alphabetical)
- **URL Sync**: Sort state persisted in URL query parameters
- **Special Sorting**:
  - Members: Sorted by count from memberCounts object
  - Course: Handles missing values (treats as 0)
  - Strings: Case-insensitive alphabetical

#### 5. **Groups Table**

##### **Table Structure**
- **Responsive**: Horizontal scroll on small screens
- **Hover Effects**: Row highlights on hover
- **Animated Rows**: Staggered fade-in animation
- **Empty States**: 
  - "No groups" when list is empty
  - "No matches" when search returns no results

##### **Column Details**

1. **Name Column**
   - Group display name
   - Bold font weight
   - Sortable

2. **Course Column**
   - Number 1-4 representing course level
   - Displays "-" if not set
   - Sortable
   - Muted text color

3. **Meet ID Column**
   - Google Meet ID in format xxx-xxxx-xxx
   - Monospace font
   - Small text size
   - Sortable

4. **Members Column**
   - Count of students in the group
   - Calculated from student data
   - Displays "0" if no members
   - Sortable
   - Muted text color

5. **Teacher Column**
   - Teacher name
   - Displays "-" if not set
   - Sortable
   - Muted text color

6. **Avg Completion Column**
   - Average task completion percentage
   - Color-coded:
     - Green: ≥75%
     - Yellow: 50-74%
     - Red: <50%
   - Displays "-" if no data
   - Sortable by avgTaskCompletion field
   - Icon: PieChart
   - Abbreviated header: "Avg" with icon

7. **Avg Mark Column**
   - Average mark on 5-point scale
   - Color-coded:
     - Green: ≥4.0
     - Yellow: 3.0-3.99
     - Red: <3.0
   - Displays "-" if no data
   - Two decimal places (e.g., "4.25")
   - Sortable
   - Icon: Star
   - Abbreviated header: "Avg" with icon

8. **Mode Mark Column** (Hidden by default)
   - Most frequently occurring mark
   - Displays "-" if no data
   - Sortable
   - Icon: Star
   - Abbreviated header: "Mode" with icon

9. **Median Mark Column** (Hidden by default)
   - Median mark value
   - Displays "-" if no data
   - Sortable
   - Icon: Star
   - Abbreviated header: "Median" with icon

10. **Actions Column**
    - Always visible (not toggleable)
    - Right-aligned
    - Contains three action buttons

##### **Action Buttons**

1. **QR Code Button**
   - Icon: QrCode
   - Tooltip: "Show QR Code"
   - Opens QR code modal for the meetId
   - Muted color, highlights on hover

2. **Edit Button**
   - Icon: Edit2
   - Tooltip: "Edit"
   - Opens edit modal with group data pre-filled
   - Muted color, highlights on hover

3. **Delete Button**
   - Icon: Trash2
   - Tooltip: "Delete"
   - Opens confirmation modal
   - Destructive color (red)
   - Highlights on hover

#### 6. **Group Modal** (Create/Edit)

The modal is used for both creating new groups and editing existing ones.

##### **Modal Header**
- **Title**: 
  - "Add Group" for new groups
  - "Edit Group" for existing groups
- **Close Button**: X icon in top-right
- **ESC Key**: Close modal

##### **Form Fields**

1. **Group Name** (Required)
   - Text input
   - Required field (marked with red asterisk)
   - Placeholder: "e.g., КІ-301"
   - Autofocus on modal open
   - **Auto-suggest Course**: Automatically extracts course number from name
     - Example: "КІ-301" → Course 3
     - Example: "ІП-42" → Course 4

2. **Course**
   - Number input
   - Optional field
   - Range: 1-4
   - Placeholder: "1, 2, 3, or 4"
   - Auto-filled from group name if number detected

3. **Meet ID** (Required)
   - Text input with autocomplete
   - Required field (marked with red asterisk)
   - Placeholder: "xxx-xxxx-xxx"
   - **Autocomplete Dropdown**:
     - Shows existing meetIds from uploaded reports
     - Filters as you type
     - Click to select
     - Chevron button to toggle dropdown
   - **Smart Paste**: 
     - Detects Google Meet URLs
     - Extracts meetId automatically
     - Example: Paste "https://meet.google.com/abc-defg-hij" → "abc-defg-hij"
   - **Focus/Blur**: Dropdown shows on focus, hides on blur

4. **Teacher Name**
   - Text input with autocomplete
   - Optional field
   - Placeholder: Teacher name
   - **Default Value**: Pre-filled with default teacher from settings (for new groups)
   - **Autocomplete Dropdown**:
     - Shows existing teacher names from other groups
     - Filters as you type
     - Click to select
     - Chevron button to toggle dropdown
   - **Focus/Blur**: Dropdown shows on focus, hides on blur

##### **Modal Actions**
- **Cancel Button**: Close modal without saving
- **Save Button**: 
  - Icon: Save icon
  - Saves group data
  - Closes modal on success
  - Creates new group or updates existing

##### **Validation**
- Name and MeetId are required
- Course must be 1-4 if provided
- No explicit validation shown (handled by backend/composable)

#### 7. **Delete Confirmation Modal**
- **Title**: "Delete Group"
- **Message**: Confirmation message
- **Confirm Button**: "Delete" (destructive styling)
- **Cancel Button**: "Cancel"
- **ESC Key**: Close modal
- **Click Outside**: Close modal

#### 8. **QR Code Modal**
- **Purpose**: Generate QR code for meetId
- **Content**: QR code image encoding the meetId
- **Use Case**: Share with students for easy meeting access
- **Close**: ESC key, click outside, or close button

#### 9. **Responsive Design**
- **Mobile Layout**: 
  - Full-width buttons
  - Horizontal scroll for table
  - Stacked header elements
- **Desktop Layout**:
  - Inline header elements
  - Auto-width buttons
  - Full table visible
- **Touch-Friendly**: Large tap targets for mobile

#### 10. **State Management**
- **URL Query Sync**: Search and sort state in URL
- **Browser History**: Back/forward navigation preserves state
- **Deep Linking**: Share URLs with specific filters/sort applied
- **LocalStorage**: Column visibility preferences
- **SessionStorage**: Not used on this page

---

## Data Calculations

### Member Count
- **Source**: Calculated from student data
- **Logic**: Count of students where group name matches
- **Display**: Number of students in each group
- **Updates**: Recalculated when student data changes

### Average Task Completion
- **Source**: Calculated from student task completion data
- **Logic**: Average percentage of completed tasks across all students in group
- **Range**: 0-100%
- **Display**: Percentage with color coding
- **Empty**: "-" if no task data

### Average Mark
- **Source**: Calculated from student marks
- **Logic**: Mean of all student marks in the group
- **Scale**: 5-point scale
- **Display**: Two decimal places with color coding
- **Empty**: "-" if no mark data

### Mode Mark
- **Source**: Calculated from student marks
- **Logic**: Most frequently occurring mark
- **Display**: Single number
- **Empty**: "-" if no mark data

### Median Mark
- **Source**: Calculated from student marks
- **Logic**: Middle value when marks are sorted
- **Display**: Single number (or average of two middle values)
- **Empty**: "-" if no mark data

---

## User Workflows

### Common Tasks

1. **Create a New Group**
   - Click "Add Group" button
   - Enter group name (e.g., "КІ-301")
   - Course auto-fills from name
   - Select or enter meetId
   - Optionally enter teacher name
   - Click "Save"

2. **Edit Existing Group**
   - Click edit icon on group row
   - Modify fields as needed
   - Click "Save"

3. **Delete a Group**
   - Click delete icon on group row
   - Confirm deletion in modal
   - Group removed from list

4. **Find a Specific Group**
   - Use search bar to filter by name or meetId
   - Results update in real-time

5. **Sort Groups**
   - Click column header to sort
   - Click again to reverse order
   - Sort by any column (name, course, members, etc.)

6. **Show/Hide Columns**
   - Click column picker icon
   - Toggle checkboxes for desired columns
   - Reset to defaults if needed

7. **Generate QR Code**
   - Click QR icon on group row
   - QR code modal opens
   - Share with students

8. **View Group Statistics**
   - Scan table for color-coded metrics
   - Green = good, yellow = okay, red = needs attention
   - Sort by completion or marks to identify struggling groups

---

## Integration with Other Pages

### Analytics Page
- **Groups Map**: Groups data used to enrich analytics
- **Display Names**: Group names shown instead of raw meetIds
- **Teacher Info**: Teacher names displayed in analytics
- **Course Organization**: Analytics organized by course level

### Students Page
- **Group Assignment**: Students assigned to groups by name
- **Member Count**: Student count calculated for each group
- **Statistics**: Group statistics calculated from student data

### Marks Page
- **Group Context**: Marks associated with students in groups
- **Aggregation**: Group-level mark statistics calculated

### Reports Page
- **MeetId Mapping**: Reports linked to groups via meetId
- **Group Names**: Group names displayed in reports list

---

## Technical Notes

### URL Structure
- Groups Page: `/groups?search=...&sort=...&order=...`

### Data Flow
1. Load groups from repository
2. Load student data to calculate member counts
3. Calculate statistics (completion, marks)
4. Enrich with metadata
5. Filter and sort
6. Display in table

### State Management
- Component-level state (Vue refs)
- Composables: useGroups, useQuerySync, useColumnVisibility
- LocalStorage: Column visibility preferences
- URL query parameters: Search and sort state

### Autocomplete Logic
- **MeetIds**: Extracted from all uploaded reports
- **Teachers**: Extracted from existing groups
- **Filtering**: Case-insensitive substring match
- **Selection**: Click or keyboard navigation

### Smart Features

#### Auto-suggest Course
- Regex: `/\d/` to find first digit in group name
- Extracts course number (1-4)
- Only applies if course field is empty
- Works for both new and edited groups

#### Smart Paste for MeetId
- Regex: `/[a-z]{3}-[a-z]{4}-[a-z]{3}/`
- Detects Google Meet ID format
- Extracts from full URL or standalone ID
- Prevents default paste behavior
- Fills meetId field automatically

#### Default Teacher
- Loaded from settings on modal mount
- Pre-fills teacher field for new groups
- Saves time for repeated group creation
- Can be overridden per group

---

## Best Practices

### Group Naming
- Use consistent naming convention (e.g., "КІ-301", "ІП-42")
- Include course number in name for auto-detection
- Keep names short and descriptive

### Course Assignment
- Always assign course level for proper organization
- Analytics page groups by course
- Helps with filtering and reporting

### Teacher Assignment
- Set default teacher in settings for efficiency
- Override per group as needed
- Consistent teacher names improve autocomplete

### MeetId Management
- Use QR codes for easy student access
- One meetId per group recommended
- Reuse meetIds across semesters if desired

### Data Hygiene
- Delete unused groups to keep list clean
- Update group info when course/teacher changes
- Use search to find groups quickly

---

## Comparison: Groups vs Analytics

### Groups Page
- **Focus**: Group metadata management
- **Purpose**: Create, edit, delete groups
- **Data**: Group configuration (name, meetId, teacher, course)
- **Statistics**: Aggregated metrics displayed in table
- **Actions**: CRUD operations on groups

### Analytics Page
- **Focus**: Multi-session analytics per group
- **Purpose**: View attendance and participation trends
- **Data**: Aggregated report data by meetId
- **Statistics**: Sessions, duration, participants, attendance
- **Actions**: View details, generate QR codes

### Key Difference
- **Groups**: Manages the group entities themselves
- **Analytics**: Analyzes data for existing groups
- **Relationship**: Groups provide metadata for Analytics display
