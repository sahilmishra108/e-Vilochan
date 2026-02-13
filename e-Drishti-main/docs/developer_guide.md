# Developer Guide

## Project Structure

The project is a monorepo-style structure containing both frontend and backend.

```
e-Drishti-main/
├── server/                 # Backend Node.js/Express application
│   ├── config.env          # Environment variables (create this)
│   ├── index.js            # Main server entry point
│   ├── schema.sql          # Database schema script
│   └── package.json        # Backend dependencies
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components (routed)
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── public/                 # Static assets
├── docs/                   # Project documentation
├── index.html              # HTML template
├── package.json            # Frontend dependencies
├── vite.config.ts          # Vite configuration
└── tailwind.config.ts      # Tailwind CSS configuration
```

## Setup and Installation

### Prerequisites
*   **Node.js**: Version 18 or higher.
*   **MySQL**: Key database service. Must be running locally or accessible remotely.
*   **Hugging Face Account**: Required for the OCR API (Free tier is sufficient).

### Steps

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd e-Drishti-main
    ```

2.  **Install Dependencies**
    *   **Frontend**:
        ```bash
        npm install
        ```
    *   **Backend**:
        ```bash
        cd server
        npm install
        cd ..
        ```

3.  **Database Configuration**
    *   Start your MySQL server.
    *   Create the database and tables using the provided schema.
        ```bash
        mysql -u root -p < server/schema.sql
        ```
    *   Verify that the `vitalview` database has been created.

4.  **Environment Variables**
    Create a `.env` file in the `server/` directory with the following content:
    ```env
    PORT=3000
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=your_password
    DB_NAME=vitalview
    HF_ACCESS_TOKEN=hf_your_token_here
    JWT_SECRET=your_secret_key
    email_user=your_email@gmail.com
    email_pass=your_app_password
    ```

### Running the Application

The project uses `concurrently` (implied or recommended) or separate terminals to run both ends.

**Option 1: Unified Command (if configured in root package.json)**
```bash
npm run dev
```

**Option 2: Separate Terminals**
*   **Terminal 1 (Backend)**:
    ```bash
    cd server
    node index.js
    ```
*   **Terminal 2 (Frontend)**:
    ```bash
    npm run dev
    ```

## Development Workflow

### Frontend
*   To add a new page: Create a component in `src/pages/` and add a route in `src/App.tsx`.
*   To add a UI component: Create it in `src/components/` (use Shadcn/ui where possible).
*   Styles: Use Tailwind CSS utility classes.

### Backend
*   To add an API endpoint: Add the route handler in `server/index.js`.
*   To modify the database:
    1.  Edit `server/schema.sql` for future reference.
    2.  Manually run the `ALTER` SQL command on your local database.
    3.  Add the migration logic to the `Auto-Migrate` section in `index.js` for other developers.

## Troubleshooting

*   **"Vite not found"**: Ensure you ran `npm install` in the root directory.
*   **"Module not found: server/index.js"**: Make sure you are running the backend from the `server` directory or focusing on the right path.
*   **Database Connection Refused**: Check your `.env` credentials and ensure MySQL service is running.
