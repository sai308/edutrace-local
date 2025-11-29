# Settings Functionality

This document provides a detailed overview of the **Settings Modal**, which serves as the central control panel for application configuration, data management, and global operations.

---

## Settings Modal

The Settings Modal is divided into three main tabs: **General**, **Data**, and **Advanced**.

### 1. General Settings

This tab focuses on user preferences and global defaults.

#### **Language**
- **Selector**: Dropdown to switch the application language.
- **Options**:
  - English (US)
  - Ukrainian (UA)
- **Effect**: Changes are applied immediately across the entire application.

#### **Default Teacher**
- **Input**: Text field to set a default teacher name.
- **Usage**: This name is automatically pre-filled when creating new groups or adding students, saving time during data entry.
- **Action**: "Save" button to persist the setting.

#### **Duration Limit**
- **Input**: Number field to set the maximum expected duration for sessions (in minutes).
- **Default**: 75 minutes.
- **Purpose**: Used to identify "infinite" meetings or outliers where a student might have forgotten to leave a call.
- **Actions**:
  - **Save**: Updates the limit for future calculations.
  - **Apply to All**: Recalculates attendance percentages for *all existing reports* based on the new limit.

#### **Teachers Management**
- **Manage Button**: Opens a dedicated **Teachers List** modal.
- **Functionality**:
  - Add, edit, or remove teacher names.
  - These names are used to filter out teachers from student lists in reports and analytics.
  - Shows a badge with the total count of configured teachers.

---

### 2. Data Management

This tab provides granular control over the data stored in the **current workspace**.

#### **Workspace Overview**
- Displays the **Current Workspace Name**.
- Shows **Total Size** of data in the current workspace.

#### **Entity Cards**
Data is categorized into four main entities: **Reports**, **Groups**, **Marks**, and **Members**. Each card displays:
- **Count**: Number of records (e.g., "12 Reports").
- **Memory Usage**: Storage size (e.g., "1.5 MB").
- **Actions**:
  - **Export**: Download specific data as a JSON file (e.g., `reports-2024-03-20.json`).
  - **Import**: Upload a previously exported JSON file of that specific type.
  - **Erase**: Permanently delete all data of that specific type from the current workspace.

---

### 3. Advanced Settings

This tab handles global operations that affect the entire application or multiple workspaces.

#### **Global Operations**
- **Statistics**:
  - **Total Records**: Aggregated count of all items across the application.
  - **Total Size**: Total storage usage.
  - **Workspace Details**: Toggle to view the size of each individual workspace.

- **Global Actions**:
  - **Export All**: 
    - Creates a full backup of the application data.
    - Supports **Multi-Workspace Export**: If multiple workspaces exist, a selection modal appears to choose which ones to include in the backup.
  - **Import All**: 
    - Restores a full backup.
    - Supports **Multi-Workspace Import**: Can restore multiple workspaces at once, creating them if they don't exist.
  - **Erase All**: 
    - **Destructive Action**: Wipes all data from the application, resetting it to a fresh state.
    - Requires confirmation.
    - If multiple workspaces exist, allows selecting specific workspaces to erase.

#### **Sync (Coming Soon)**
- Placeholder for future cloud synchronization features.

---

## Modals & Workflows

### **Confirmation Modals**
- All destructive actions (Erase, Overwrite) require explicit confirmation via a popup modal to prevent accidental data loss.

### **Workspace Selection Modal**
- Triggered during **Export All**, **Import All**, or **Erase All** operations if multiple workspaces are detected.
- Allows the user to check/uncheck specific workspaces to apply the action to.

### **Teachers List Modal**
- A simple list interface to add or remove teacher names.
- Ensures that teachers attending meetings aren't counted as students in attendance statistics.
