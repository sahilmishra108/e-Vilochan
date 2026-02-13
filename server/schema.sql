-- Create Database
CREATE DATABASE IF NOT EXISTS vitalview;

USE vitalview;

-- Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ICUs Table
CREATE TABLE IF NOT EXISTS icus (
    icu_id INT AUTO_INCREMENT PRIMARY KEY,
    icu_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    hospital_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals (hospital_id) ON DELETE CASCADE,
    UNIQUE (icu_name, hospital_id)
);

-- Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'doctor', 'staff') DEFAULT 'admin',
    assigned_icu_id INT,
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals (hospital_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_icu_id) REFERENCES icus (icu_id) ON DELETE SET NULL
);

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    age INT,
    gender VARCHAR(50),
    diagnosis TEXT,
    admission_date DATE,
    icu_id INT,
    assigned_doctor_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (icu_id) REFERENCES icus (icu_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_doctor_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL
);

-- Beds Table
CREATE TABLE IF NOT EXISTS beds (
    bed_id INT AUTO_INCREMENT PRIMARY KEY,
    icu_id INT,
    bed_number VARCHAR(50) NOT NULL,
    patient_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (icu_id) REFERENCES icus (icu_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE SET NULL,
    UNIQUE (icu_id, bed_number)
);

-- Vitals Table
CREATE TABLE IF NOT EXISTS vitals (
    vital_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    hr INT,
    pulse INT,
    spo2 INT,
    abp VARCHAR(50),
    pap VARCHAR(50),
    etco2 INT,
    awrr INT,
    source VARCHAR(50) DEFAULT 'manual',
    additional_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE
);

-- Daily Vital Summaries Table
CREATE TABLE IF NOT EXISTS daily_vital_summaries (
    summary_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    summary_date DATE,
    hr_min INT,
    hr_max INT,
    pulse_min INT,
    pulse_max INT,
    spo2_min INT,
    spo2_max INT,
    etco2_min INT,
    etco2_max INT,
    awrr_min INT,
    awrr_max INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE,
    UNIQUE KEY patient_date (patient_id, summary_date)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT,
    icu_id INT,
    sender_id INT,
    content TEXT,
    message_type ENUM('text', 'image') DEFAULT 'text',
    image_url VARCHAR(555),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals (hospital_id) ON DELETE CASCADE,
    FOREIGN KEY (icu_id) REFERENCES icus (icu_id) ON DELETE SET NULL,
    FOREIGN KEY (sender_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL
);

-- Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    doctor_id INT,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL
);