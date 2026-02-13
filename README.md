# e-Vilochan

A comprehensive telemedicine platform for real-time patient vital signs monitoring using advanced OCR technology and AI-powered analysis.

##  Features

- **Patient Records System**: Manage patient admissions, bed assignments, and medical history.
- **Real-Time Camera Monitoring**: Live camera feed with automatic vital signs extraction every 30 seconds.
- **AI-Powered OCR**: Utilizes **Hugging Face (Qwen2.5-VL-7B-Instruct)** for high-accuracy vital sign extraction, with **Tesseract.js** as a robust fallback.
- **Video Processing**: Upload and analyze video files to extract vital signs data.
- **Comprehensive Dashboard**: View historical data, trends, and analytics with interactive charts.
- **Real-Time Notifications**: Get alerts for abnormal vital signs readings via Socket.io.
- **Data Export**: Export monitoring data to CSV for further analysis.
- **Responsive Design**: Works seamlessly across desktop and mobile devices.

## 📚 Documentation

We have detailed documentation available for different aspects of the project:

*   **[System Architecture](docs/system_architecture.md)**: High-level overview, technology stack, and component diagrams.
*   **[API Documentation](docs/api_documentation.md)**: Detailed API reference for all endpoints.
*   **[Database Schema](docs/database_schema.md)**: ER diagrams and table structure.
*   **[User Manual](docs/user_manual.md)**: Guide for Doctors, Staff, and Admins on how to use the dashboard and monitoring tools.
*   **[Developer Guide](docs/developer_guide.md)**: Setup instructions, folder structure, and development workflow.

##  Security & Privacy

- **Data Isolation**: Patient data is strictly segregated in the database.
- **Secure Communication**: API calls and real-time events are handled securely.
- **Environment Variables**: Sensitive keys (DB credentials, API keys) are never committed to version control.

##  Contributing

1.  Fork the repository
2.  Create a feature branch
3.  Make your changes
4.  Submit a pull request

##  License

This project is licensed under the MIT License.
