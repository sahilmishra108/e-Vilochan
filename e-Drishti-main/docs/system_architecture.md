# System Architecture

## Overview
e-Vilochan is a comprehensive telemedicine platform designed for real-time patient vital signs monitoring. It leverages advanced OCR technology and AI-powered analysis to provide accurate and timely health data. The system is built using a modern web application architecture, separating the frontend user interface from the backend server logic and database.

## Technology Stack

### Frontend
*   **Framework**: React 18.3.1 with TypeScript
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS with Shadcn/ui components
*   **Routing**: React Router DOM
*   **State Management**: React Query
*   **Real-Time Communication**: Socket.io Client
*   **Data Visualization**: Recharts

### Backend
*   **Runtime Environment**: Node.js
*   **Web Framework**: Express.js
*   **Database**: MySQL (accessed via `mysql2`)
*   **Real-Time Communication**: Socket.io Server
*   **AI/OCR Integration**:
    *   **Hugging Face Inference API**: For Qwen2.5-VL-7B-Instruct (Primary OCR/Analysis)
    *   **Tesseract.js**: For on-device OCR (Fallback)
    *   **Groq SDK**: For additional AI processing (if configured)
*   **Authentication**: JSON Web Tokens (JWT) & bcrypt

## High-Level Architecture

The system follows a classic Client-Server architecture:

1.  **Client (Browser)**: The React application runs in the user's browser. It handles the UI, user interactions, and displays real-time data. It communicates with the backend via HTTP (REST API) for standard data operations and WebSockets (Socket.io) for real-time updates (vitals, chat).
2.  **Server (Node.js/Express)**: The backend API server handles business logic, authentication, and database interactions. It exposes RESTful endpoints and manages WebSocket connections. It also orchestrates the AI/OCR processing.
3.  **Database (MySQL)**: Stores persistent data such as patient records, user accounts, vital signs history, and chat messages.
4.  **External AI Services**: The server communicates with Hugging Face APIs for advanced image processing and OCR tasks.

## Data Flow

### Real-Time Vitals Monitoring
1.  **Capture**: The client captures video frames from the camera or uploaded video.
2.  **Transmission**: Frames are sent to the backend or processed locally (Tesseract).
3.  **Processing**: The backend sends frames to the Hugging Face API (Qwen2.5-VL).
4.  **Extraction**: The AI model extracts vital signs (HR, SpO2, etc.) from the image.
5.  **Storage**: Extracted vitals are saved to the MySQL `vitals` table.
6.  **Broadcast**: The server emits a `vital-update` event via Socket.io.
7.  **Display**: Connected clients receive the update and refresh the dashboard charts/tables.

### Chat System
1.  **Sending**: User sends a message via the frontend chat interface.
2.  **Socket Event**: The client emits a `send-message` event to the server.
3.  **Persistence**: The server saves the message to the `messages` table.
4.  **Routing**: The server determines the correct room (Hospital, ICU, or Patient-specific) and broadcasts the message.
5.  **Receiving**: Users in the same room receive the message in real-time.

## Component Diagram (Mermaid)

```mermaid
graph TD
    Client[Client (React Application)]
    Server[Server (Node.js / Express)]
    DB[(MySQL Database)]
    HF[Hugging Face API]

    Client -- HTTP Requests --> Server
    Client -- WebSocket (Socket.io) --> Server
    Server -- SQL Queries --> DB
    Server -- Inference API --> HF
```
