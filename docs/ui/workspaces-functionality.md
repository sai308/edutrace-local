# Workspaces Functionality

This document provides a detailed overview of the **Workspaces** functionality, which allows users to manage multiple distinct environments for different semesters, classes, or contexts.

---

## Workspace Switcher

The Workspace Switcher is located in the top navigation bar (or header) and serves as the primary interface for managing workspaces.

### Core Features

#### 1. **Workspace Indicator**
- **Current Workspace**: Displays the name and icon of the currently active workspace.
- **Dropdown Menu**: Clicking the indicator reveals the full list of available workspaces and management options.

#### 2. **Switching Workspaces**
- **List View**: Shows all created workspaces with their assigned icons.
- **Active State**: The current workspace is highlighted with a checkmark and distinct background color.
- **Action**: Clicking any workspace in the list instantly switches the application context to that workspace.

#### 3. **Workspace Management**
- **Create New**: "+ Create New" button at the bottom of the dropdown opens the creation modal.
- **Edit**: Pencil icon (visible on hover) allows renaming or changing the icon of an existing workspace.
- **Delete**: Trash icon (visible on hover) allows permanently deleting a workspace.
  - *Note*: The "Default" workspace cannot be deleted or renamed, but its icon can be changed (if supported).

#### 4. **Guide Access**
- **Help Button**: A question mark icon in the dropdown header links directly to the "Workspaces" section of the Guide page for quick assistance.

---

## Modals & Workflows

### 1. **Create Workspace Modal**
- **Name Input**: Text field for the new workspace name (e.g., "Fall 2024").
- **Icon Selection**: A 6x4 grid of 24 distinct icons to visually differentiate the workspace.
  - Icons include academic and utility symbols (e.g., Book, Calculator, Atom, Code).
  - Selected icon is highlighted.
- **Copy Settings**: Checkbox to "Copy settings from current workspace".
  - **Enabled**: Copies preferences like "Duration Limit", "Default Teacher", and "Column Visibility" to the new workspace.
  - **Disabled**: Starts with fresh default settings.
- **Action**: "Create" button initializes the workspace and automatically switches to it.

### 2. **Edit Workspace Modal**
- **Name Input**: Rename the workspace.
- **Icon Selection**: Change the assigned icon.
- **Action**: "Update" button saves changes immediately.

### 3. **Delete Workspace Modal**
- **Safety Mechanism**: Requires typing the exact name of the workspace to confirm deletion.
- **Warning**: Clearly states that this action is irreversible and will erase all data (Reports, Groups, Marks, etc.) associated with that workspace.

---

## Bulk Operations (Settings)

Workspaces are integrated into the **Settings > Advanced** tab for global data management.

### **Multi-Workspace Selection**
When performing global actions (Export All, Import All, Erase All), if multiple workspaces exist, a **Selection Modal** appears:
- **Checkboxes**: Select specific workspaces to include in the operation.
- **Select All / Deselect All**: Quick toggle for bulk selection.
- **Context**: Shows the total number of selected workspaces.

### **Use Cases**
- **Backup**: Export "Fall 2023" and "Spring 2024" together into a single backup file.
- **Migration**: Import a multi-workspace backup to restore your entire history on a new device.
- **Cleanup**: Bulk delete old semesters (e.g., "2021 Archives") while keeping current ones active.
