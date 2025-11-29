# Reports Page Functionality

This document provides a detailed list of available functionalities on the **Reports Page** and **Report Details Page** based on the user interface.

---

## Reports Page

The Reports Page displays a list of all uploaded meeting reports with comprehensive filtering, sorting, and management capabilities.

### Core Features

#### 1. **File Upload**
- **Drag & Drop Zone**: Drop CSV files to upload new meeting reports
- **Processing Indicator**: Visual feedback during file processing
- **Automatic Parsing**: Uploaded files are automatically parsed and stored

#### 2. **Reports List Display**
- **Table View**: Displays all reports in a sortable, filterable table
- **Row Selection**: Checkbox for each report to enable bulk operations
- **Select All**: Master checkbox to select/deselect all visible reports
- **Animated Rows**: Staggered fade-in animation for better UX

#### 3. **Column Management**
- **Column Picker**: Toggle visibility of columns
- **Available Columns**:
  - Group (badge with filter capability)
  - Meet ID (clickable filter badge)
  - Date (with calendar icon)
  - Participants (count)
  - Duration (with clock icon)
  - Filename (hidden by default, truncated with tooltip)
  - Uploaded At (date and time with icons)
  - Actions (view and delete buttons)
- **Reset Columns**: Restore default column visibility
- **Persistent State**: Column preferences saved to localStorage

#### 4. **Search & Filtering**
- **Search Bar**: Full-text search across report display names (group + meetId)
- **Paste Support**: Special handling for pasting meetId values
- **Filter by Meet ID**: Click any meetId badge to filter reports
- **Filter by Group**: Click any group badge to filter reports
- **Active Filters Display**: Visual chips showing active filters with remove buttons
- **Combined Filters**: Search and filters work together

#### 5. **Sorting**
- **Sortable Columns**:
  - Group (alphabetical)
  - Meet ID (alphabetical)
  - Date (chronological)
  - Duration (numerical)
  - Filename (alphabetical)
  - Uploaded At (chronological)
- **Sort Indicators**: Arrow icons showing current sort direction
- **Toggle Sort**: Click column header to cycle through asc/desc/none
- **Default Sort**: Date descending (newest first)
- **URL Sync**: Sort state persisted in URL query parameters

#### 6. **Bulk Operations**
- **Bulk Delete**: Delete multiple selected reports at once
- **Selection Count**: Badge showing number of selected reports
- **Confirmation Modal**: Safety confirmation before bulk deletion
- **Clear Selection**: Automatic deselection after operation

#### 7. **Individual Report Actions**
- **View Details**: Eye icon button to navigate to Report Details page
  - Automatically opens in table view
- **Delete Report**: Trash icon button to delete single report
  - Confirmation modal before deletion
- **Tooltips**: Hover tooltips on action buttons

#### 8. **Data Display Features**
- **Group Badges**: Colored badges for group names (clickable filters)
- **Meet ID Badges**: Monospace font badges for meet codes (clickable filters)
- **Date Formatting**: Localized date display with calendar icon
- **Duration Formatting**: Human-readable duration (e.g., "1h 30m") with clock icon
- **Participant Count**: Simple numeric display
- **Upload Timestamp**: Compact date and time display with separate icons
- **Empty State**: Helpful message when no reports exist or no matches found

#### 9. **Responsive Design**
- **Mobile Layout**: Horizontal scroll for table on small screens
- **Flexible Columns**: Minimum widths to prevent squashing
- **Sticky Actions**: Actions column always visible

#### 10. **State Management**
- **URL Query Sync**: Search, sort, filters synced with URL
- **Browser History**: Back/forward navigation preserves state
- **Deep Linking**: Share URLs with specific filters/search/sort applied

---

## Report Details Page

The Report Details Page shows comprehensive information about a single meeting report with multiple visualization modes.

### Core Features

#### 1. **Navigation**
- **Back Button**: Return to Reports list
- **Breadcrumb Info**: Display report ID and context

#### 2. **Report Metadata**
- **Session Information Card**:
  - Date of the meeting
  - Original filename
  - Upload timestamp
  - Meet ID/code
  - Time range (start - end time)
- **Grid Layout**: Responsive 2-5 column grid for metadata
- **Truncation**: Long filenames truncated with tooltip

#### 3. **View Mode Toggle**
Three distinct visualization modes for analyzing report data:

##### **Overview Mode** (Timeline Visualization)
- **Timeline Chart**: Horizontal bar chart showing participant attendance
- **Time Markers**: Grid lines for visual time reference
- **Participant Bars**:
  - Color-coded by attendance percentage:
    - Green (≥75%)
    - Yellow (50-74%)
    - Red (<50%)
  - Positioned based on join time offset
  - Width represents duration
  - Shows join time label if space permits
- **Participant Details**: Name, duration, and percentage for each participant
- **Session Time Range**: Display of session start and end times
- **Legend**: Color coding explanation

##### **Table Mode**
- **Participant Table**:
  - Participant name
  - Group name (if available)
  - First seen time (join time)
  - Total duration
  - Attendance percentage (color-coded badge)
- **Sortable**: Not currently sortable (static display)
- **Animated Rows**: Staggered fade-in animation
- **Color-Coded Badges**:
  - Green: ≥75%
  - Yellow: 50-74%
  - Red: <50%
- **Monospace Times**: Easy-to-read time formatting

##### **Calendar Mode**
- **Monthly Calendar View**: Full month grid display
- **Month Navigation**: Previous/next month buttons
- **Current Month Display**: Centered month/year header
- **Day Cells**:
  - Current month days highlighted
  - Today marked with special styling
  - Session day highlighted in green
- **Session Day Details**:
  - "Session" badge
  - Start time with clock icon
  - Participant count with users icon
- **Weekday Headers**: Mon-Sun labels
- **Visual Hierarchy**: Clear distinction between current/other months

#### 4. **View Mode Persistence**
- **URL Sync**: Current view mode saved in URL query parameter
- **Deep Linking**: Share links to specific view modes
- **Default View**: Table mode by default

#### 5. **Teacher Filtering**
- **Automatic Exclusion**: Teacher (if identified) excluded from participant lists
- **Teacher Display**: Teacher name shown in header badge
- **Ignored Users**: Users marked as ignored are filtered out

#### 6. **Loading States**
- **Loading Spinner**: Displayed while fetching report data
- **Error Handling**: Error message display if data fetch fails

#### 7. **Responsive Design**
- **Mobile Optimized**: All views work on mobile devices
- **Horizontal Scroll**: Table scrolls horizontally on small screens
- **Flexible Grid**: Overview cards adapt to screen size
- **Touch-Friendly**: Calendar and buttons sized for touch interaction

#### 8. **Data Calculations**
- **Duration Limit**: Respects global duration limit setting
- **Percentage Calculation**: Attendance percentage based on session duration
- **Time Offset**: Calculates join time offset from session start
- **Participant Filtering**: Excludes teachers and ignored users

---

## Additional Features

### Localization
- **Multi-language Support**: All UI text is localized (English, Ukrainian)
- **Date Formatting**: Locale-aware date/time formatting
- **Tooltips**: Translated hover help text

### Performance
- **Lazy Loading**: Components loaded on demand
- **Efficient Rendering**: Virtual scrolling for large datasets (if applicable)
- **Debounced Search**: Search input debounced to reduce re-renders
- **Memoized Computations**: Expensive calculations cached

### Accessibility
- **Keyboard Navigation**: Full keyboard support for interactive elements
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Logical tab order
- **Color Contrast**: Sufficient contrast for readability
- **Tooltips**: Additional context for icon-only buttons

### Data Persistence
- **LocalStorage**: Column preferences, ignored users
- **IndexedDB**: Report data storage
- **URL State**: Search, sort, filter state in URL

---

## User Workflows

### Common Tasks

1. **Upload a New Report**
   - Drag CSV file to drop zone
   - Wait for processing
   - Report appears in list

2. **Find a Specific Report**
   - Use search bar to filter by name/ID
   - OR click group/meetId badge to filter
   - OR sort by date/duration

3. **View Report Details**
   - Click eye icon on report row
   - Choose visualization mode (overview/table/calendar)
   - Navigate back when done

4. **Delete Old Reports**
   - Select reports using checkboxes
   - Click bulk delete button
   - Confirm deletion

5. **Analyze Attendance**
   - Open report details
   - Switch to overview mode for timeline
   - OR use table mode for detailed percentages
   - OR use calendar mode for date context

6. **Compare Multiple Sessions**
   - Filter by meetId to see all sessions for a group
   - Sort by date to see chronological order
   - View each report individually

---

## Technical Notes

### URL Structure
- Reports List: `/reports?search=...&sort=...&order=...&meetId=...&group=...`
- Report Details: `/reports/:id?view=overview|table|calendar`

### Data Flow
1. CSV upload → Parser → IndexedDB storage
2. Reports list → Query from IndexedDB → Filter/Sort → Display
3. Report details → Analytics service → Process data → Visualize

### State Management
- Component-level state (Vue refs)
- Composables for shared logic (useSort, useColumnVisibility, etc.)
- URL query parameters for shareable state
- LocalStorage for user preferences
