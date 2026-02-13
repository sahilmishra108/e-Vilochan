# API Documentation

## Base URL
The API is served at `/api`.
For example: `http://localhost:3000/api`

## Authentication

### Register
*   **URL**: `/api/auth/register`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "name": "Dr. Smith",
      "email": "dr.smith@example.com",
      "password": "securepassword",
      "hospital_id": 1,
      "registrationType": "hospital" // or "staff"
    }
    ```
*   **Response**: `201 Created` with `{ message: "User registered successfully" }`

### Login
*   **URL**: `/api/auth/login`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "email": "dr.smith@example.com",
      "password": "securepassword"
    }
    ```
*   **Response**: `200 OK` with `{ token: "jwt_token", user: { ... } }`

## Patients

### Get All Patients (for a hospital)
*   **URL**: `/api/patients?hospitalId=1`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**: Array of patient objects.

### Get Single Patient
*   **URL**: `/api/patients/:id`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**: Patient object with ICU and Bed details.

### FHIR Export
*   **URL**: `/api/patients/:id/fhir`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**: HL7 FHIR R4 Bundle containing Patient, Observation (Vitals), and MedicationRequest (Prescriptions) resources.

## Vitals

### Get Vitals History
*   **URL**: `/api/vitals/:patientId`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**: Array of vital sign records ordered by time (descending).

## Messages (Chat)

### Get Messages
*   **URL**: `/api/messages/:hospitalId`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Query Params**: `icu_id` (optional), `patient_id` (optional)
*   **Response**: Array of message objects with sender details.

### Upload Image
*   **URL**: `/api/messages/upload`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**: `{ "image": "base64_string" }`
*   **Response**: `{ "url": "base64_string" }`

## Prescriptions

### Get Prescriptions
*   **URL**: `/api/prescriptions/:patientId`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**: Array of prescriptions.

### Add Prescription
*   **URL**: `/api/prescriptions`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "patient_id": 1,
      "medication_name": "Paracetamol",
      "dosage": "500mg",
      "frequency": "BID",
      "instructions": "After food"
    }
    ```
*   **Response**: `201 Created`

## Questionnaires

### Get Questionnaires
*   **URL**: `/api/questionnaires/:patientId`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`

### Add Questionnaire
*   **URL**: `/api/questionnaires`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**: `{ "patient_id": 1, "question": "Patient feeling dizzy?" }`

## Public Routes

### Get Hospitals
*   **URL**: `/api/public/hospitals`
*   **Method**: `GET`
*   **Response**: List of hospitals.

### Get ICUs
*   **URL**: `/api/public/hospitals/:id/icus`
*   **Method**: `GET`
*   **Response**: List of ICUs for the specified hospital.
