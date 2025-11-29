# Analytics Page Functionality

This document provides a detailed list of available functionalities on the **Analytics Page** and **Analytics Details Page** based on the user interface.

---

## Analytics Page

The Analytics Page provides an overview of all meeting groups with aggregated statistics, organized by course level for easy navigation.

### Core Features

#### 1. **Dashboard Overview**
- **Title**: "Analytics" heading at the top
- **Automatic Data Loading**: Statistics loaded on page mount
- **Refresh Capability**: Can refresh data programmatically
- **Loading State**: Spinner displayed while fetching data

#### 2. **Search Functionality**
- **Search Bar**: Full-text search across all groups
- **Search Scope**: Searches through:
  - Meet ID
  - Group/display name
  - Teacher name
- **Real-time Filtering**: Results update as you type
- **URL Sync**: Search query persisted in URL parameters
- **Search Icon**: Visual indicator in search input

#### 3. **Course-Based Organization**
Groups are automatically organized into collapsible sections by course level:

##### **Section Structure**
- **4th Course**: Groups from 4th year
- **3rd Course**: Groups from 3rd year
- **2nd Course**: Groups from 2nd year
- **1st Course**: Groups from 1st year
- **Other Meets**: Groups without course assignment or ungrouped meetIds

##### **Section Features**
- **Collapsible Sections**: Click section header to expand/collapse
- **Collapse Icons**: 
  - ChevronRight when collapsed
  - ChevronDown when expanded
- **Item Count Badge**: Shows number of groups when collapsed
- **Persistent State**: Collapse state saved to sessionStorage
- **Search Override**: All sections auto-expand when searching
- **Alphabetical Sorting**: Groups sorted alphabetically within each section
- **Empty Section Hiding**: Sections with no items are hidden

#### 4. **Group Cards**
Each group is displayed as an interactive card with comprehensive statistics:

##### **Card Header**
- **Group Name**: Primary display name (or meetId if no group)
- **Teacher Badge**: Small badge showing teacher name (if available)
- **Meet ID**: Displayed below group name
- **Copy Button**: Copy meetId to clipboard (appears on hover)
  - Toast notification on success/error
- **QR Code Button**: Generate QR code for the meetId
- **Attendance Badge**: Color-coded percentage badge
  - Green: ≥75%
  - Yellow: 50-74%
  - Red: <50%

##### **Card Statistics Grid**
Three key metrics displayed in a grid:

1. **Total Sessions**
   - Number of meeting sessions recorded
   - Large bold number display
   - Tooltip: "Total number of sessions"

2. **Average Duration**
   - Average session duration in minutes
   - Displayed as "~XX min"
   - Rounded to nearest minute
   - Tooltip: "Average session duration"

3. **Participants**
   - Shows "Active / Total" format
   - Active: Participants with attendance ≥50%
   - Total: Unique participants across all sessions
   - Tooltip: "Active participants / Total participants"

##### **Card Interactions**
- **Click to View Details**: Entire card is clickable
- **Hover Effects**: 
  - Shadow elevation on hover
  - Copy button fades in
  - Smooth transitions
- **Stop Propagation**: QR and copy buttons don't trigger card click

#### 5. **QR Code Modal**
- **Purpose**: Generate QR code for easy meetId sharing
- **Trigger**: Click QR icon on any group card
- **Content**: QR code encoding the meetId
- **Close**: Click outside, ESC key, or close button

#### 6. **Empty States**
- **No Data**: Message when no analytics data exists
- **No Search Results**: Filtered view shows empty state if no matches

#### 7. **Responsive Design**
- **Grid Layout**: 
  - Mobile: 1 column
  - Tablet: 2 columns
  - Desktop: 3 columns
- **Card Sizing**: Flexible cards adapt to screen size
- **Touch-Friendly**: Large tap targets for mobile

#### 8. **Data Enrichment**
Groups are enriched with metadata from groupsMap:
- Display name (group name)
- Teacher name
- Course level
- Grouped status flag

---

## Analytics Details Page

The Analytics Details Page shows comprehensive multi-session analytics for a specific group/meetId, with three visualization modes.

### Core Features

#### 1. **Navigation**
- **Back Button**: Return to Analytics dashboard
- **Breadcrumb Info**: Display group name and meetId
- **Teacher Badge**: Shows teacher name if available

#### 2. **View Mode Toggle**
Three distinct visualization modes (only available for multi-session analytics):

##### **Overview Mode** (Card Grid)
- **Session Cards**: Grid layout of all session dates
- **Card Content**:
  - **Date**: Formatted session date
  - **Duration Badge**: Total session duration
  - **Time Range**: Start - end time (if available)
  - **Participant List**: All participants with:
    - Name (truncated with tooltip)
    - Duration
    - Status indicator (colored dot)
    - Percentage tooltip
- **View Report Button**: Eye icon to view individual report
- **Grid Layout**: Responsive 1-4 columns based on screen size

##### **Table Mode** (Attendance Matrix)
- **Sticky Header**: 
  - First column: Participant names (sticky left)
  - Date columns: One per session
  - Total column: Overall attendance percentage
- **Participant Rows**:
  - Name in first column (sticky)
  - Attendance cells for each date:
    - Percentage display
    - Color-coded background (green/yellow/red)
    - Hover shows duration tooltip
  - Total percentage badge (color-coded)
- **Empty Cells**: Dash (-) for no attendance
- **Horizontal Scroll**: Table scrolls horizontally on small screens
- **Animated Rows**: Staggered fade-in animation

##### **Calendar Mode**
- **Monthly Calendar View**: Full month grid
- **Month Navigation**: Previous/next month buttons
- **Current Month Display**: Centered month/year header
- **Weekday Headers**: Mon-Sun labels
- **Day Cells**:
  - Current month days highlighted
  - Today marked with special styling
  - Session days highlighted
- **Session Day Details**:
  - Session date badge
  - Start time with clock icon
  - Participant count with users icon
  - End time with label
- **Click Interaction**: Click session day to view details modal
- **Visual Hierarchy**: Clear distinction between current/other months

#### 3. **Day Details Modal**
Triggered by clicking a session day in calendar view:

##### **Modal Header**
- **Title**: "Session Details"
- **Subtitle**: Date and meetId
- **Close Button**: X icon in top-right

##### **Participant Table**
- **Columns**:
  - Participant name
  - Duration (formatted)
  - Status (color-coded percentage badge)
- **Sticky Header**: Header stays visible while scrolling
- **Animated Rows**: Staggered fade-in
- **Empty State**: Message if no participants

##### **Modal Footer**
- **Participant Count**: Total number of participants
- **Close Button**: Primary action button

##### **Interactions**
- **ESC Key**: Close modal
- **Click Outside**: Close modal
- **Close Button**: Close modal

#### 4. **Data Filtering**
- **Teacher Exclusion**: Teacher automatically excluded from participant lists
- **Ignored Users**: Users marked as ignored are filtered out
- **Active Filtering**: Applied across all view modes

#### 5. **View Report Link**
- **Overview Mode**: Eye icon on each session card
- **Functionality**: Navigate to individual Report Details page
- **Context**: Opens in table view by default
- **Tooltip**: "View report" on hover

#### 6. **Loading & Error States**
- **Loading Spinner**: Displayed while fetching analytics data
- **Error Display**: Error message if data fetch fails
- **Empty State**: Message if no data available

#### 7. **URL State Management**
- **View Mode**: Current view persisted in URL query parameter
- **Deep Linking**: Share links to specific view modes
- **Browser History**: Back/forward navigation preserves view state

#### 8. **Responsive Design**
- **Mobile Optimized**: All views work on mobile devices
- **Horizontal Scroll**: Table scrolls horizontally on small screens
- **Flexible Grid**: Overview cards adapt to screen size
- **Touch-Friendly**: Calendar and buttons sized for touch interaction
- **Collapsible Sections**: Better mobile navigation

---

## Data Calculations & Processing

### Analytics Page Calculations

#### **Attendance Percentage**
- Calculated across all sessions for the group
- Based on participant attendance rates
- Weighted average of all session percentages

#### **Total Sessions**
- Count of unique session dates for the meetId
- Includes all uploaded reports for the group

#### **Average Duration**
- Mean duration across all sessions
- Calculated in seconds, displayed in minutes
- Rounded to nearest minute

#### **Participant Counts**
- **Active**: Participants with ≥50% attendance in any session
- **Total**: Unique participants across all sessions
- Excludes teachers and ignored users

### Analytics Details Calculations

#### **Session Duration**
- Calculated from participant join/leave times
- Respects global duration limit setting
- Falls back to metadata if participant data unavailable

#### **Attendance Percentage**
- Individual: (participant duration / session duration) × 100
- Total: Average across all sessions

#### **Time Range**
- Start: Earliest participant join time
- End: Latest participant leave time
- Displayed in 24-hour format

---

## User Workflows

### Common Tasks

1. **Browse All Groups**
   - View organized sections by course
   - Expand/collapse sections as needed
   - Scan attendance badges for quick insights

2. **Find Specific Group**
   - Use search bar to filter by name/ID/teacher
   - Click on group card to view details

3. **View Group Analytics**
   - Click group card
   - Choose visualization mode:
     - Overview for session-by-session view
     - Table for attendance matrix
     - Calendar for date-based view

4. **Check Specific Session**
   - In overview mode: View session card
   - In calendar mode: Click session day
   - View participant list and details

5. **Share Meet ID**
   - Click QR code icon on group card
   - Show QR code to participants
   - OR click copy icon to copy meetId

6. **Navigate to Report**
   - From overview mode: Click eye icon on session
   - Opens individual report details

7. **Analyze Attendance Trends**
   - Use table mode to see attendance matrix
   - Identify patterns across sessions
   - Check total attendance percentages

---

## Technical Notes

### URL Structure
- Analytics Dashboard: `/analytics?search=...`
- Analytics Details: `/analytics/:meetId?view=overview|table|calendar`

### Data Flow
1. Analytics service processes all reports
2. Groups data by meetId
3. Calculates aggregate statistics
4. Enriches with group metadata
5. Organizes by course level
6. Filters and displays

### State Management
- Component-level state (Vue refs)
- Composables for shared logic (useAnalytics, useCalendar, etc.)
- SessionStorage for section collapse state
- URL query parameters for search and view mode
- LocalStorage for ignored users

### Performance Optimizations
- Computed properties for filtering/sorting
- Memoized calculations
- Lazy section rendering (collapsed by default)
- Efficient re-renders on search

---

## Comparison: Analytics vs Reports

### Analytics Page
- **Focus**: Aggregated multi-session data per group
- **Organization**: By course level
- **Cards**: Summary statistics (sessions, duration, participants)
- **Purpose**: High-level overview and group comparison

### Reports Page
- **Focus**: Individual session reports
- **Organization**: Flat list with filters
- **Table**: Detailed report metadata
- **Purpose**: Manage and view specific sessions

### Analytics Details
- **Focus**: Multi-session analysis for one group
- **Views**: Overview, table, calendar
- **Data**: Attendance trends across multiple sessions
- **Purpose**: Deep dive into group performance

### Report Details
- **Focus**: Single session analysis
- **Views**: Overview (timeline), table, calendar
- **Data**: Individual session participant details
- **Purpose**: Analyze specific session attendance
