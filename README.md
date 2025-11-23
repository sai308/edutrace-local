# Edutrace

A local-first application for managing student attendance and marks, designed to streamline the process of parsing Google Meet reports and tracking student progress.

## Features

-   **Reports Management**: Import and parse Google Meet attendance reports (CSV).
-   **Analytics Dashboard**: Visualize attendance trends and statistics.
-   **Group & Student Management**: Organize students into groups and track their participation.
-   **Marks Tracking**: Record and manage student grades with support for various grading systems.
-   **Local Data Persistence**: All data is stored locally in your browser using IndexedDB for privacy and speed.
-   **Responsive Design**: Built with a modern, responsive UI using Tailwind CSS.

## Tech Stack

-   **Framework**: [Vue 3](https://vuejs.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Routing**: [Vue Router](https://router.vuejs.org/)
-   **State/Logic**: [VueUse](https://vueuse.org/)
-   **Internationalization**: [Vue I18n](https://kazupon.github.io/vue-i18n/)
-   **Data Storage**: [IDB](https://github.com/jakearchibald/idb) (IndexedDB wrapper)
-   **CSV Parsing**: [PapaParse](https://www.papaparse.com/)
-   **Icons**: [Lucide Vue](https://lucide.dev/guide/packages/lucide-vue-next)

## Project Setup

### Prerequisites

-   [Node.js](https://nodejs.org/) (Latest LTS version recommended)

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/sai308/edutrace-local.git
    cd edutrace-local
    ```

2.  Install dependencies:
    ```sh
    npm install
    ```

### Development

Start the development server with hot-reload:

```sh
npm run dev
```

### Production

Build the application for production:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```
