import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { HfInference } from '@huggingface/inference';
import Tesseract from 'tesseract.js';
import cron from 'node-cron';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Groq } from 'groq-sdk';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, 'config.env');
const envPath = fs.existsSync(configPath) ? configPath : path.resolve(__dirname, '.env');


dotenv.config({ path: envPath });

console.log('--- Server Startup Config Check ---');
console.log('HF_ACCESS_TOKEN:', process.env.HF_ACCESS_TOKEN ? 'Loaded (Starts with ' + process.env.HF_ACCESS_TOKEN.substring(0, 3) + '...)' : 'MISSING');
console.log('Gemini API Key:', process.env.GEMINI_API_KEY ? 'Loaded' : 'MISSING');
console.log('Email User:', process.env.EMAIL_USER || 'MISSING');
console.log('Email Pass:', process.env.EMAIL_PASS ? 'Loaded (Redacted)' : 'MISSING');
console.log('DB Connection:', {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  db: process.env.DB_NAME || 'vitalview'
});
console.log('-----------------------------------');



const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // 10MB limit
});

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'vitals-view-super-secret-key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vitalview',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Nodemailer Setup
import nodemailer from 'nodemailer';

const emailTransporter = nodemailer.createTransport({
  service: 'gmail', // Standard provider, can be configured via env
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@example.com';

// Web Push Setup

// Alert Thresholds & Rate Limiting
const ALERT_RANGES = {
  HR: { low: 60, high: 100 },
  Pulse: { low: 60, high: 100 },
  SpO2: { low: 90, high: 100 },
  EtCO2: { low: 35, high: 45 },
  awRR: { low: 12, high: 20 },
  ABP_sys: { low: 90, high: 140 },
  PAP_dia: { low: 5, high: 15 }
};

// Rate limiting: Map<"patientId-vitalType", timestamp>
// Now changed to state tracking to only alert on status change
const vitalStateMap = new Map();

async function checkAndAlert(vital, patientId) {
  const alertsToSend = [];

  const check = (type, value, range) => {
    if (value === null || value === undefined) return;

    let currentCondition = 'Normal';
    if (value < range.low) currentCondition = 'Low';
    else if (value > range.high) currentCondition = 'High';

    const key = `${patientId}-${type}`;
    const previousCondition = vitalStateMap.get(key) || 'Normal';

    // Update state
    vitalStateMap.set(key, currentCondition);

    // Alert only on state change to Abnormal (Normal -> Abnormal or Abnormal -> Different Abnormal)
    // If it stays High -> High, no new email.
    if (currentCondition !== 'Normal' && currentCondition !== previousCondition) {
      alertsToSend.push({ type, value, condition: currentCondition });
    }
  };

  check('HR', vital.hr, ALERT_RANGES.HR);
  check('Pulse', vital.pulse, ALERT_RANGES.Pulse);
  check('SpO2', vital.spo2, ALERT_RANGES.SpO2);
  check('EtCO2', vital.etco2, ALERT_RANGES.EtCO2);
  check('awRR', vital.awrr, ALERT_RANGES.awRR);

  // Check ABP Systolic
  if (vital.abp) {
    const sys = parseInt(vital.abp.split('/')[0]);
    check('ABP_sys', sys, ALERT_RANGES.ABP_sys);
  }

  // Check PAP Diastolic
  if (vital.pap) {
    const dia = parseInt(vital.pap.split('/')[1]);
    check('PAP_dia', dia, ALERT_RANGES.PAP_dia);
  }

  if (alertsToSend.length === 0) return;

  // Fetch Patient, Doctor, Staff, and Hospital Details
  let patientName = 'Unknown Patient';
  let icuName = 'Unknown ICU';
  let icuId = null;
  let hospitalId = null;
  let bedNumber = 'N/A';
  let hospitalName = 'e-Drishti Hospital';
  const recipientsMap = new Map(); // Use Map to de-duplicate by email

  try {
    // 1. Fetch Patient and Basic ICU/Hospital Info
    const [patientRows] = await pool.query(`
      SELECT 
        p.patient_name, 
        p.icu_id,
        i.icu_name, 
        i.hospital_id,
        b.bed_number,
        h.hospital_name,
        p.assigned_doctor_id
      FROM patients p 
      LEFT JOIN icus i ON p.icu_id = i.icu_id
      LEFT JOIN beds b ON p.patient_id = b.patient_id
      LEFT JOIN hospitals h ON i.hospital_id = h.hospital_id
      WHERE p.patient_id = ?
      LIMIT 1
    `, [patientId]);

    if (patientRows.length > 0) {
      const p = patientRows[0];
      patientName = p.patient_name;
      icuName = p.icu_name || 'No ICU';
      icuId = p.icu_id;
      hospitalId = p.hospital_id;
      bedNumber = p.bed_number || 'N/A';
      hospitalName = p.hospital_name || hospitalName;

      // 2. Fetch Assigned Doctor specifically
      if (p.assigned_doctor_id) {
        const [docRows] = await pool.query('SELECT doctor_id, name, email, role FROM doctors WHERE doctor_id = ?', [p.assigned_doctor_id]);
        if (docRows.length > 0) {
          recipientsMap.set(docRows[0].email, {
            doctor_id: docRows[0].doctor_id,
            name: docRows[0].name,
            email: docRows[0].email,
            role: docRows[0].role
          });
        }
      }

      // 3. Fetch all Doctors and Admins assigned to this ICU
      if (icuId) {
        const [clinicalRows] = await pool.query('SELECT doctor_id, name, email, role FROM doctors WHERE assigned_icu_id = ? AND role IN ("doctor", "admin")', [icuId]);
        clinicalRows.forEach(r => {
          if (!recipientsMap.has(r.email)) {
            recipientsMap.set(r.email, { doctor_id: r.doctor_id, name: r.name, email: r.email, role: r.role });
          }
        });

        // 4. Fetch Staff correlated with this ICU
        const [staffRows] = await pool.query('SELECT doctor_id, name, email, role FROM doctors WHERE assigned_icu_id = ? AND role = "staff"', [icuId]);
        staffRows.forEach(s => {
          if (!recipientsMap.has(s.email)) {
            recipientsMap.set(s.email, { doctor_id: s.doctor_id, name: s.name, email: s.email, role: s.role });
          }
        });
      }

      // 5. Fallback: If no clinical recipients found, fetch hospital admin
      const hasClinical = Array.from(recipientsMap.values()).some(r => r.role === 'doctor' || r.role === 'admin');
      if (!hasClinical && hospitalId) {
        const [adminRows] = await pool.query('SELECT doctor_id, name, email, role FROM doctors WHERE hospital_id = ? AND role = "admin"', [hospitalId]);
        adminRows.forEach(a => {
          if (!recipientsMap.has(a.email)) {
            recipientsMap.set(a.email, { doctor_id: a.doctor_id, name: a.name, email: a.email, role: a.role });
          }
        });
      }
    }

    // Absolute fallback to default env email if still empty
    if (recipientsMap.size === 0) {
      recipientsMap.set(DOCTOR_EMAIL, {
        doctor_id: null,
        name: 'On-duty Clinician',
        email: DOCTOR_EMAIL,
        role: 'doctor'
      });
    }
  } catch (err) {
    console.error('Error fetching details for alert:', err);
  }

  const recipients = Array.from(recipientsMap.values());

  for (const alert of alertsToSend) {
    for (const recipient of recipients) {
      const isClinical = recipient.role === 'doctor' || recipient.role === 'admin';
      const recipientLabel = isClinical ? 'Doctor' : 'Staff Member';
      const dearSalutation = isClinical ? `Dr. ${recipient.name}` : recipient.name;

      const mailOptions = {
        from: `"${hospitalName}" <${process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject: `ALERT: ${patientName} - ${alert.type} ${alert.condition}`,
        text: `CRITICAL VITAL SIGN ALERT\n\n` +
          `Hospital:       ${hospitalName}\n` +
          `${recipientLabel}:  ${recipient.name}\n\n` +
          `Patient Name:   ${patientName}\n` +
          `Patient ID:     ${patientId}\n` +
          `ICU Name:       ${icuName}\n` +
          `Bed Number:     ${bedNumber}\n\n` +
          `Vital Sign:     ${alert.type}\n` +
          `Status:         ${alert.condition} (${alert.value})\n` +
          `Timestamp:      ${new Date().toLocaleString()}\n\n` +
          `Dear ${dearSalutation},\n` +
          `Please attend to the patient immediately.`
      };

      try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Alert email sent to ${recipient.role} ${recipient.email} for Patient ${patientId} (${patientName}) - ${alert.type} (${alert.condition})`);
      } catch (error) {
        if (error.code === 'EENVELOPE') {
          console.warn(`Invalid email address for recipient ${recipient.email}. Skipping email alert.`);
        } else {
          console.error(`Failed to send alert email to ${recipient.email}:`, error);
        }
      }
    }

  }
}

// Test DB Connection & Auto-Migrate
pool.getConnection()
  .then(async (connection) => {
    console.log('Database connected successfully');

    // Auto-Migration for Staff Features
    try {
      const [columns] = await connection.query("SHOW COLUMNS FROM doctors LIKE 'role'");
      if (columns.length === 0) {
        console.log("Migrating DB: Adding 'role' column to doctors...");
        await connection.query("ALTER TABLE doctors ADD COLUMN role ENUM('admin', 'doctor', 'staff') DEFAULT 'admin' AFTER password");
      }

      const [icuColumns] = await connection.query("SHOW COLUMNS FROM doctors LIKE 'assigned_icu_id'");
      if (icuColumns.length === 0) {
        console.log("Migrating DB: Adding 'assigned_icu_id' column to doctors...");
        await connection.query("ALTER TABLE doctors ADD COLUMN assigned_icu_id INT AFTER role");
        await connection.query("ALTER TABLE doctors ADD CONSTRAINT fk_assigned_icu FOREIGN KEY (assigned_icu_id) REFERENCES icus(icu_id) ON DELETE SET NULL");
      }

      // Migration for message_type audio support
      const [msgTypeCols] = await connection.query("SHOW COLUMNS FROM messages LIKE 'message_type'");
      if (msgTypeCols.length > 0) {
        const typeDefinition = msgTypeCols[0].Type;
        if (!typeDefinition.includes("'audio'")) {
          console.log("Migrating DB: Adding 'audio' to messages.message_type ENUM...");
          await connection.query("ALTER TABLE messages MODIFY COLUMN message_type ENUM('text', 'image', 'audio') DEFAULT 'text'");
        }
      }

      // Migration for messages table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS messages (
            message_id INT AUTO_INCREMENT PRIMARY KEY,
            hospital_id INT,
            icu_id INT,
            patient_id INT,
            sender_id INT,
            content TEXT,
            message_type ENUM('text', 'image', 'audio') DEFAULT 'text',
            image_url LONGTEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hospital_id) REFERENCES hospitals (hospital_id) ON DELETE CASCADE,
            FOREIGN KEY (icu_id) REFERENCES icus (icu_id) ON DELETE SET NULL,
            FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL
        )
      `);

      const [msgPatientCols] = await connection.query("SHOW COLUMNS FROM messages LIKE 'patient_id'");
      if (msgPatientCols.length === 0) {
        console.log("Migrating DB: Adding 'patient_id' column to messages...");
        await connection.query("ALTER TABLE messages ADD COLUMN patient_id INT AFTER icu_id");
        await connection.query("ALTER TABLE messages ADD CONSTRAINT fk_messages_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE");
      }

      const [msgIcuCols] = await connection.query("SHOW COLUMNS FROM messages LIKE 'icu_id'");
      if (msgIcuCols.length === 0) {
        console.log("Migrating DB: Adding 'icu_id' column to messages...");
        await connection.query("ALTER TABLE messages ADD COLUMN icu_id INT AFTER hospital_id");
        await connection.query("ALTER TABLE messages ADD CONSTRAINT fk_messages_icu FOREIGN KEY (icu_id) REFERENCES icus(icu_id) ON DELETE SET NULL");
      }

      // Fix messages image_url length
      const [msgImgCols] = await connection.query("SHOW COLUMNS FROM messages LIKE 'image_url'");
      if (msgImgCols.length > 0 && msgImgCols[0].Type.toLowerCase().includes('varchar')) {
        console.log("Migrating DB: Changing messages.image_url to LONGTEXT...");
        await connection.query("ALTER TABLE messages MODIFY COLUMN image_url LONGTEXT");
      }

      const [msgReadCols] = await connection.query("SHOW COLUMNS FROM messages LIKE 'is_read'");
      if (msgReadCols.length === 0) {
        console.log("Migrating DB: Adding 'is_read' column to messages...");
        await connection.query("ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE AFTER image_url");
      }

      // Migration for prescriptions table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS prescriptions (
            prescription_id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT,
            doctor_id INT,
            medication_name VARCHAR(255) NOT NULL,
            dosage VARCHAR(100),
            frequency VARCHAR(100),
            instructions TEXT,
            image_url LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL
        )
      `);

      const [prescImgCols] = await connection.query("SHOW COLUMNS FROM prescriptions LIKE 'image_url'");
      if (prescImgCols.length === 0) {
        console.log("Migrating DB: Adding 'image_url' column to prescriptions...");
        await connection.query("ALTER TABLE prescriptions ADD COLUMN image_url LONGTEXT AFTER instructions");
      }

      // Migration for questionnaires table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS questionnaires (
            questionnaire_id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT,
            doctor_id INT,
            question TEXT NOT NULL,
            answer TEXT,
            status ENUM('pending', 'answered') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL
        )
      `);

      // Migration for additional_data in vitals
      const [vitalsCols] = await connection.query("SHOW COLUMNS FROM vitals LIKE 'additional_data'");
      if (vitalsCols.length === 0) {
        console.log("Migrating DB: Adding 'additional_data' column to vitals...");
        await connection.query("ALTER TABLE vitals ADD COLUMN additional_data JSON AFTER source");
      }

      // Migration for patients table to support SBAR persistence
      const [patientCols] = await connection.query("SHOW COLUMNS FROM patients LIKE 'sbar_summary'");
      if (patientCols.length === 0) {
        console.log("Migrating DB: Adding 'sbar_summary' column to patients...");
        await connection.query("ALTER TABLE patients ADD COLUMN sbar_summary LONGTEXT AFTER diagnosis");
      }


    } catch (err) {
      console.error('Migration Warning:', err.message);
    }

    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to database:', err);
  });

// Hugging Face Setup
let hfToken = process.env.HF_ACCESS_TOKEN;
if (hfToken) {
  hfToken = hfToken.trim();
  if (!hfToken.startsWith('hf_')) {
    console.warn('Invalid HF_ACCESS_TOKEN format (should start with "hf_"). Using anonymous mode.');
    hfToken = undefined;
  }
}
const hf = new HfInference(hfToken);


let groq;
if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_')) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} else {
  console.warn(" GROQ_API_KEY is missing or invalid. AI features (Vitals/SBAR) will be disabled.");
}

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-patient', (patientId) => {
    socket.join(`patient-${patientId}`);
    socket.join(`patient-chat-${patientId}`); // Clinical chat room for this patient
    console.log(`Socket ${socket.id} joined patient-${patientId} and clinical chat`);
  });

  socket.on('join-icu', (icuId) => {
    socket.join(`icu-${icuId}`);
    socket.join(`icu-chat-${icuId}`); // General ICU chat room
    console.log(`Socket ${socket.id} joined icu-${icuId} and ICU chat`);
  });

  socket.on('join-hospital', (hospitalId) => {
    socket.join(`hospital-${hospitalId}`);
    console.log(`Socket ${socket.id} joined hospital-${hospitalId} chat`);
  });

  socket.on('monitoring-started', (data) => {
    const { hospital_id, icu_id, patient_id, staff_name } = data;
    console.log(`Monitoring started for Patient ${patient_id} by ${staff_name}`);

    // Notify all doctors in the ICU or Hospital
    if (icu_id) {
      io.to(`icu-${icu_id}`).emit('monitoring-notify', { patient_id, staff_name });
    } else {
      io.to(`hospital-${hospital_id}`).emit('monitoring-notify', { patient_id, staff_name });
    }
  });

  socket.on('monitoring-stopped', (data) => {
    const { patient_id, hospital_id, icu_id } = data;
    console.log(`Monitoring stopped for Patient ${patient_id}`);

    // Relay to the patient's room so doctors can clear their UI
    io.to(`patient-${patient_id}`).emit('monitoring-stopped', data);

    // Also relay to Hospital/ICU rooms for MultiPatientMonitor
    if (icu_id) {
      io.to(`icu-${icu_id}`).emit('monitoring-stopped', data);
    }
    if (hospital_id) {
      io.to(`hospital-${hospital_id}`).emit('monitoring-stopped', data);
    }
  });

  socket.on('vital-update', (data) => {
    const { patient_id, hospital_id, icu_id } = data;
    // Relay vitals to the patient's room for real-time doctor view
    io.to(`patient-${patient_id}`).emit('vital-update', data);

    // Also relay to Hospital/ICU rooms for MultiPatientMonitor
    if (icu_id) {
      io.to(`icu-${icu_id}`).emit('vital-update', data);
    }
    if (hospital_id) {
      io.to(`hospital-${hospital_id}`).emit('vital-update', data);
    }
  });

  socket.on('send-message', async (messageData) => {
    const { hospital_id, icu_id, patient_id, sender_id, content, message_type, image_url } = messageData;

    try {
      // Fetch sender details from DB to ensure accurate metadata
      const [senders] = await pool.query('SELECT name, role FROM doctors WHERE doctor_id = ?', [sender_id]);
      const sender = senders[0];
      const sender_name = sender ? sender.name : 'Unknown User';
      const sender_role = sender ? sender.role : 'Staff';

      // Save to database
      const [result] = await pool.query(
        'INSERT INTO messages (hospital_id, icu_id, patient_id, sender_id, content, message_type, image_url, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)',
        [hospital_id, icu_id || null, patient_id || null, sender_id, content, message_type || 'text', image_url || null]
      );

      const newMessage = {
        message_id: result.insertId,
        hospital_id,
        icu_id,
        patient_id,
        sender_id,
        content,
        message_type: message_type || 'text',
        image_url: image_url || null,
        sender_name,
        sender_role,
        created_at: new Date()
      };

      // Broadcast logic:
      // 1. If patient_id is present, it's a patient-specific clinical chat
      // 2. Otherwise fall back to ICU room or Hospital room
      if (patient_id) {
        io.to(`patient-chat-${patient_id}`).emit('receive-message', newMessage);
        // Also broadcast to ICU/Hospital so global listeners (Dashboard) can notify
        if (icu_id) {
          io.to(`icu-chat-${icu_id}`).emit('receive-message', newMessage);
        } else {
          io.to(`hospital-${hospital_id}`).emit('receive-message', newMessage);
        }
      } else if (icu_id) {
        io.to(`icu-chat-${icu_id}`).emit('receive-message', newMessage);
      } else {
        io.to(`hospital-${hospital_id}`).emit('receive-message', newMessage);
      }
    } catch (error) {
      console.error('Error handling send-message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


// Chat Routes
app.get('/api/messages/:hospitalId', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.params.hospitalId;
    const { icu_id, patient_id } = req.query;

    // Verify user belongs to this hospital
    if (req.user.hospital_id != hospitalId) {
      return res.status(403).json({ error: 'Unauthorized to access this hospital\'s chat' });
    }

    let query = `
      SELECT m.*, d.name as sender_name, d.role as sender_role 
      FROM messages m 
      LEFT JOIN doctors d ON m.sender_id = d.doctor_id 
      WHERE m.hospital_id = ?
    `;
    let params = [hospitalId];

    if (patient_id) {
      query += " AND m.patient_id = ?";
      params.push(patient_id);
    } else if (icu_id) {
      query += " AND m.icu_id = ?";
      params.push(icu_id);
    }

    query += " ORDER BY m.created_at ASC LIMIT 100";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/messages/:hospitalId', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.params.hospitalId;
    const { icu_id, patient_id } = req.query;

    if (req.user.hospital_id != hospitalId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let query = 'DELETE FROM messages WHERE hospital_id = ?';
    let params = [hospitalId];

    if (patient_id) {
      query += ' AND patient_id = ?';
      params.push(patient_id);
    } else if (icu_id) {
      query += ' AND icu_id = ?';
      params.push(icu_id);
    } else {
      // Hospital-wide chat clear (maybe restricted to admins? For now allow if authenticated)
      // If we want to clear ONLY hospital-wide messages (not patient specific ones), we might check for NULLs
      // query += ' AND patient_id IS NULL AND icu_id IS NULL'; 
      // But usually "Clear Chat" means "Clear what I see".
      // The current view logic filters by hospital_id + icu_id/patient_id.
      // So we should match that.

      // However, blindly deleting WHERE hospital_id = ? would wipe EVERYTHING.
      // We should probably only target the "General Channel" if no specific ID is provided.
      query += ' AND patient_id IS NULL AND icu_id IS NULL';
    }

    await pool.query(query, params);
    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/messages/mark-read', authenticateToken, async (req, res) => {
  const { hospitalId, icuId, patientId } = req.body;

  try {
    let query = 'UPDATE messages SET is_read = TRUE WHERE hospital_id = ? AND is_read = FALSE';
    let params = [hospitalId];

    if (patientId) {
      query += ' AND patient_id = ?';
      params.push(patientId);
    } else if (icuId) {
      query += ' AND icu_id = ? AND patient_id IS NULL';
      params.push(icuId);
    } else {
      query += ' AND patient_id IS NULL AND icu_id IS NULL';
    }

    await pool.query(query, params);

    // Notify clients that messages are read
    io.to(`hospital-${hospitalId}`).emit('messages-read', { hospitalId, icuId, patientId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/messages/unread-count/:hospitalId', authenticateToken, async (req, res) => {
  const { hospitalId } = req.params;
  const { icuId, patientId } = req.query;

  try {
    let query = 'SELECT COUNT(*) as count FROM messages WHERE hospital_id = ? AND is_read = FALSE';
    let params = [hospitalId];

    if (patientId) {
      query += ' AND patient_id = ?';
      params.push(patientId);
    } else if (icuId) {
      query += ' AND icu_id = ?';
      params.push(icuId);
    }

    const [rows] = await pool.query(query, params);
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Prescription Routes
app.get('/api/prescriptions/:patientId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, d.name as doctor_name 
      FROM prescriptions p 
      LEFT JOIN doctors d ON p.doctor_id = d.doctor_id 
      WHERE p.patient_id = ? 
      ORDER BY p.created_at DESC
    `, [req.params.patientId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/prescriptions', authenticateToken, async (req, res) => {
  try {
    // Only doctors or admins can prescribe
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only doctors can issue prescriptions' });
    }

    const { patient_id, medication_name, dosage, frequency, instructions } = req.body;
    const doctor_id = req.user.doctor_id;

    const [result] = await pool.query(
      'INSERT INTO prescriptions (patient_id, doctor_id, medication_name, dosage, frequency, instructions) VALUES (?, ?, ?, ?, ?, ?)',
      [patient_id, doctor_id, medication_name, dosage, frequency, instructions]
    );

    res.status(201).json({ message: 'Prescription added', prescriptionId: result.insertId });
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/prescriptions/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { medication_name, dosage, frequency, instructions } = req.body;
    await pool.query(
      'UPDATE prescriptions SET medication_name = ?, dosage = ?, frequency = ?, instructions = ? WHERE prescription_id = ?',
      [medication_name, dosage, frequency, instructions, req.params.id]
    );

    res.json({ message: 'Prescription updated' });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/prescriptions/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM prescriptions WHERE prescription_id = ?', [req.params.id]);
    res.json({ message: 'Prescription deleted' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Questionnaire Routes
app.get('/api/questionnaires/:patientId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT q.*, d.name as doctor_name 
      FROM questionnaires q 
      LEFT JOIN doctors d ON q.doctor_id = d.doctor_id 
      WHERE q.patient_id = ? 
      ORDER BY q.created_at DESC
    `, [req.params.patientId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching questionnaires:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/questionnaires', authenticateToken, async (req, res) => {
  try {
    const { patient_id, question, answer } = req.body;
    const doctor_id = req.user.doctor_id;
    const status = answer ? 'answered' : 'pending';

    const [result] = await pool.query(
      'INSERT INTO questionnaires (patient_id, doctor_id, question, answer, status) VALUES (?, ?, ?, ?, ?)',
      [patient_id, doctor_id, question, answer || null, status]
    );

    res.status(201).json({ message: 'Questionnaire added', questionnaireId: result.insertId });
  } catch (error) {
    console.error('Error adding questionnaire:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  try {
    const { question, answer } = req.body;
    const status = answer ? 'answered' : 'pending';

    await pool.query(
      'UPDATE questionnaires SET question = ?, answer = ?, status = ? WHERE questionnaire_id = ?',
      [question, answer, status, req.params.id]
    );

    res.json({ message: 'Questionnaire updated' });
  } catch (error) {
    console.error('Error updating questionnaire:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM questionnaires WHERE questionnaire_id = ?', [req.params.id]);
    res.json({ message: 'Questionnaire deleted' });
  } catch (error) {
    console.error('Error deleting questionnaire:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// HL7 FHIR Export Endpoint
app.get('/api/patients/:id/fhir', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;

    // 1. Fetch Patient
    const [patientRows] = await pool.query(`
      SELECT p.*, i.icu_name, h.hospital_name 
      FROM patients p 
      LEFT JOIN icus i ON p.icu_id = i.icu_id 
      LEFT JOIN hospitals h ON i.hospital_id = h.hospital_id 
      WHERE p.patient_id = ?
    `, [patientId]);

    if (patientRows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    const p = patientRows[0];

    // 2. Fetch Vitals (latest 10 for monitoring context)
    const [vitalRows] = await pool.query('SELECT * FROM vitals WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10', [patientId]);

    // 3. Fetch Prescriptions
    const [prescriptionRows] = await pool.query(`
      SELECT pr.*, d.name as doctor_name 
      FROM prescriptions pr 
      LEFT JOIN doctors d ON pr.doctor_id = d.doctor_id 
      WHERE pr.patient_id = ?
    `, [patientId]);

    // Construct HL7 FHIR Bundle
    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:patient-${p.patient_id}`,
          resource: {
            resourceType: "Patient",
            id: p.patient_id.toString(),
            name: [{ text: p.patient_name }],
            gender: p.gender.toLowerCase(),
            birthDate: p.admission_date, // admission_date is used here as a placeholder for simplicity
            managingOrganization: { display: p.hospital_name }
          }
        }
      ]
    };

    // Add Vitals as Observations
    vitalRows.forEach(v => {
      fhirBundle.entry.push({
        resource: {
          resourceType: "Observation",
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
          subject: { reference: `urn:uuid:patient-${p.patient_id}` },
          effectiveDateTime: v.created_at,
          component: [
            { code: { text: "Heart Rate" }, valueQuantity: { value: v.hr, unit: "bpm" } },
            { code: { text: "SpO2" }, valueQuantity: { value: v.spo2, unit: "%" } }
          ]
        }
      });
    });

    // Add Prescriptions as MedicationRequest
    prescriptionRows.forEach(pr => {
      fhirBundle.entry.push({
        resource: {
          resourceType: "MedicationRequest",
          status: "active",
          intent: "order",
          subject: { reference: `urn:uuid:patient-${p.patient_id}` },
          medicationCodeableConcept: { text: pr.medication_name },
          dosageInstruction: [{ text: `${pr.dosage} ${pr.frequency}`, patientInstruction: pr.instructions }],
          requester: { display: pr.doctor_name }
        }
      });
    });

    res.json(fhirBundle);
  } catch (error) {
    console.error('FHIR Export failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/messages/upload', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body; // Expecting base64
    if (!image) return res.status(400).json({ error: 'No image data provided' });

    // Since we don't have a storage service, we'll just echo it back or store as base64 in life
    // For a real app, we'd upload to S3/Cloudinary.
    // For now, we'll return the base64 string as the "URL" (works for images and audio data urls)
    res.json({ url: image });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes

// Health Check
app.get('/', (req, res) => {
  res.send('VitalView Server is running');
});

// Authentication Routes
// Public API: Get all hospitals
app.get('/api/public/hospitals', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT hospital_id, hospital_name FROM hospitals ORDER BY hospital_name');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public API: Get ICUs for a specific hospital
app.get('/api/public/hospitals/:id/icus', async (req, res) => {
  try {
    const hospitalId = req.params.id;
    const [rows] = await pool.query('SELECT icu_id, icu_name FROM icus WHERE hospital_id = ? ORDER BY icu_name', [hospitalId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ICUs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // type: 'hospital' | 'staff'
    const { registrationType = 'hospital', hospital_name, address, name, email, password, hospital_id, assigned_icu_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, Email and Password are required' });
    }

    // Check if user exists
    const [existingUser] = await connection.query('SELECT * FROM doctors WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      connection.release();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let finalHospitalId = hospital_id;
    let userRole = 'admin';
    let finalIcuId = null;

    if (registrationType === 'hospital') {
      if (!hospital_name) return res.status(400).json({ error: 'Hospital Name is required' });

      // Create Hospital
      const [hRes] = await connection.query('INSERT INTO hospitals (hospital_name, address) VALUES (?, ?)', [hospital_name, address]);
      finalHospitalId = hRes.insertId;
      userRole = 'admin';

      // Seed default ICU for new Hospital
      const [iRes] = await connection.query('INSERT INTO icus (icu_name, location, hospital_id) VALUES (?, ?, ?)', ['General ICU', 'Wing A', finalHospitalId]);
      const icuId = iRes.insertId;

      // Seed beds
      const bedValues = [];
      for (let i = 1; i <= 5; i++) bedValues.push([icuId, `${i}`, null]);
      await connection.query('INSERT INTO beds (icu_id, bed_number, patient_id) VALUES ?', [bedValues]);

    } else if (registrationType === 'staff') {
      if (!finalHospitalId) return res.status(400).json({ error: 'Please select a Hospital' });
      userRole = 'staff';
      if (assigned_icu_id) finalIcuId = assigned_icu_id;
    }

    // Create User (Doctor/Staff)
    const [dRes] = await connection.query(
      'INSERT INTO doctors (hospital_id, name, email, password, role, assigned_icu_id) VALUES (?, ?, ?, ?, ?, ?)',
      [finalHospitalId, name, email, hashedPassword, userRole, finalIcuId]
    );

    await connection.commit();
    res.status(201).json({ message: 'Registration successful', hospitalId: finalHospitalId, userId: dRes.insertId, role: userRole });
  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM doctors WHERE email = ?', [email]);

    if (rows.length === 0) return res.status(401).json({ error: 'You are not registered, Please register' });

    const doctor = rows[0];
    const validPassword = await bcrypt.compare(password, doctor.password);

    if (!validPassword) return res.status(401).json({ error: 'You are not registered, Please register' });

    const token = jwt.sign(
      { doctor_id: doctor.doctor_id, hospital_id: doctor.hospital_id, name: doctor.name, role: doctor.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { doctor_id: doctor.doctor_id, name: doctor.name, email: doctor.email, hospital_id: doctor.hospital_id, role: doctor.role, icu_id: doctor.assigned_icu_id } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query('SELECT * FROM doctors WHERE email = ?', [email]);

    if (rows.length === 0) {
      // For security, don't reveal if email exists
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE doctors SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [token, expiry, email]
    );

    // Send Email
    const resetUrl = `http://localhost:8080/reset-password/${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request - e-Vilochan',
      text: `You requested a password reset. Please click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`
    };

    try {
      await emailTransporter.sendMail(mailOptions);
      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM doctors WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE doctors SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ?',
      [hashedPassword, token]
    );

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Get All Patients to be scoped
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const [rows] = await pool.query(`
            SELECT p.*, b.bed_id, b.bed_number, i.icu_name 
            FROM patients p 
            LEFT JOIN beds b ON p.patient_id = b.patient_id 
            LEFT JOIN icus i ON p.icu_id = i.icu_id
            WHERE i.hospital_id = ?
            ORDER BY p.patient_name
        `, [hospitalId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Single Patient (verify ownership)
app.get('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const query = `
      SELECT p.*, b.bed_id, b.bed_number, i.icu_name, h.hospital_name 
      FROM patients p 
      LEFT JOIN beds b ON p.patient_id = b.patient_id
      LEFT JOIN icus i ON p.icu_id = i.icu_id
      LEFT JOIN hospitals h ON i.hospital_id = h.hospital_id
      WHERE p.patient_id = ? AND i.hospital_id = ?
    `;
    const [rows] = await pool.query(query, [req.params.id, hospitalId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found or unauthorized' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add New Patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { patient_name, age, gender, diagnosis, admission_date, icu_id, assigned_doctor_id } = req.body;

    if (!patient_name || !age || !gender || !diagnosis || !admission_date || !icu_id) {
      return res.status(400).json({ error: 'All fields are required, including ICU ID' });
    }

    // 1. Insert the new patient
    const query = `
            INSERT INTO patients (patient_name, age, gender, diagnosis, admission_date, icu_id, assigned_doctor_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
    const [result] = await connection.query(query, [patient_name, age, gender, diagnosis, admission_date, icu_id, assigned_doctor_id || null]);
    const newPatientId = result.insertId;

    // 2. Find the first available bed in the SPECIFIC ICU
    // We sort by length of bed_number then bed_number to handle "1", "2", "10" correctly roughly, or just simple sort
    const [availableBeds] = await connection.query(
      'SELECT bed_id FROM beds WHERE icu_id = ? AND patient_id IS NULL ORDER BY CAST(bed_number AS UNSIGNED) ASC LIMIT 1',
      [icu_id]
    );

    let assignedBedId = null;
    if (availableBeds.length > 0) {
      assignedBedId = availableBeds[0].bed_id;
      // 3. Assign the bed to the new patient
      await connection.query('UPDATE beds SET patient_id = ? WHERE bed_id = ?', [newPatientId, assignedBedId]);
      console.log(`Assigned Bed #${assignedBedId} to new Patient #${newPatientId} in ICU #${icu_id}`);
    } else {
      console.log(`No available beds for new Patient #${newPatientId} in ICU #${icu_id}`);
    }

    await connection.commit();

    res.status(201).json({
      message: 'Patient added successfully',
      patientId: newPatientId,
      bedId: assignedBedId,
      bedAssigned: !!assignedBedId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error adding patient:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// Delete Patient
app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;
    const hospitalId = req.user.hospital_id;

    // First check if patient exists and belongs to this hospital
    const [check] = await pool.query(`
      SELECT p.* FROM patients p 
      JOIN icus i ON p.icu_id = i.icu_id 
      WHERE p.patient_id = ? AND i.hospital_id = ?
    `, [patientId, hospitalId]);

    if (check.length === 0) {
      return res.status(404).json({ error: 'Patient not found or unauthorized' });
    }

    // Delete associated vitals first 
    await pool.query('DELETE FROM vitals WHERE patient_id = ?', [patientId]);

    // Delete patient
    await pool.query('DELETE FROM patients WHERE patient_id = ?', [patientId]);

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Beds
app.get('/api/beds', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const query = `
      SELECT b.*, p.patient_name 
      FROM beds b 
      LEFT JOIN patients p ON b.patient_id = p.patient_id
      JOIN icus i ON b.icu_id = i.icu_id
      WHERE i.hospital_id = ?
      ORDER BY b.bed_number
    `;
    const [rows] = await pool.query(query, [hospitalId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Vitals (General or Patient Specific)
app.get('/api/vitals', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const limit = parseInt(req.query.limit) || 100;
    const [rows] = await pool.query(`
      SELECT v.* FROM vitals v
      JOIN patients p ON v.patient_id = p.patient_id
      JOIN icus i ON p.icu_id = i.icu_id
      WHERE i.hospital_id = ?
      ORDER BY v.created_at DESC LIMIT ?
    `, [hospitalId, limit]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/vitals/:patientId', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const limit = parseInt(req.query.limit) || 1000;
    const [rows] = await pool.query(`
      SELECT v.* FROM vitals v
      JOIN patients p ON v.patient_id = p.patient_id
      JOIN icus i ON p.icu_id = i.icu_id
      WHERE v.patient_id = ? AND i.hospital_id = ?
      ORDER BY v.created_at DESC LIMIT ?
    `, [req.params.patientId, hospitalId, limit]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Vital Record
app.delete('/api/vitals/:id', authenticateToken, async (req, res) => {
  try {
    const vitalId = req.params.id;
    const hospitalId = req.user.hospital_id;
    if (!vitalId) {
      return res.status(400).json({ error: 'Vital ID is required' });
    }

    // Verify ownership
    const [check] = await pool.query(`
      SELECT v.vital_id FROM vitals v
      JOIN patients p ON v.patient_id = p.patient_id
      JOIN icus i ON p.icu_id = i.icu_id
      WHERE v.vital_id = ? AND i.hospital_id = ?
    `, [vitalId, hospitalId]);

    if (check.length === 0) {
      return res.status(404).json({ error: 'Vital record not found or unauthorized' });
    }

    const [result] = await pool.query('DELETE FROM vitals WHERE vital_id = ?', [vitalId]);
    res.json({ message: 'Vital record deleted successfully' });
  } catch (error) {
    console.error('Error deleting vital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete All Vitals (with optional patient_id)
app.delete('/api/vitals', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.query;
    const hospitalId = req.user.hospital_id;

    if (patientId) {
      // Verify patient belongs to hospital
      const [check] = await pool.query(`
        SELECT p.patient_id FROM patients p
        JOIN icus i ON p.icu_id = i.icu_id
        WHERE p.patient_id = ? AND i.hospital_id = ?
      `, [patientId, hospitalId]);

      if (check.length === 0) {
        return res.status(403).json({ error: 'Unauthorized to delete vitals for this patient' });
      }

      await pool.query('DELETE FROM vitals WHERE patient_id = ?', [patientId]);
    } else {
      // Delete all vitals for hospital
      await pool.query(`
        DELETE v FROM vitals v
        JOIN patients p ON v.patient_id = p.patient_id
        JOIN icus i ON p.icu_id = i.icu_id
        WHERE i.hospital_id = ?
      `, [hospitalId]);
    }

    res.json({ message: 'Vitals deleted successfully' });
  } catch (error) {
    console.error('Error deleting vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Helper Functions for AI Pipeline ---

async function extractWithLlama(imageBase64) {
  if (!groq) {
    console.error('Groq client not initialized. Missing API Key.');
    return null;
  }
  try {
    console.log('Attempting Groq Llama extraction...');
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this medical monitor screen. Extract ALL visible vital signs into a strict JSON format.
keys: Use standard keys (HR, Pulse, SpO2, ABP, PAP, EtCO2, awRR) where applicable.
For any OTHER extracted parameters (e.g. Temp, CVP, BIS), use their label as the key.
Set missing values to null.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ]
        }
      ],
      model: "meta-llama/llama-4-maverick-17b-128e-instruct", // Best available vision model on Groq
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    console.log('Llama Response:', content);
    return JSON.parse(content);
  } catch (error) {
    console.error('Groq Llama extraction failed:', error.message);
    return null;
  }
}

async function extractWithQwen(imageBase64) {
  try {
    console.log('Attempting Hugging Face Qwen extraction...');
    const response = await hf.chatCompletion({
      model: "Qwen/Qwen2.5-VL-72B-Instruct", // Higher param model as requested
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract ALL vital signs from this medical monitor image. Return strictly valid JSON.
Standard Keys: HR, Pulse, SpO2, ABP (systolic/diastolic), PAP (systolic/diastolic), EtCO2, awRR.
Include any other visible parameters (Temp, CVP, etc) with their label as the key.
Values should be numbers or "systolic/diastolic" strings. Use null if not visible.`
            },
            {
              type: "image_url",
              image_url: { url: imageBase64 }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    console.log('Qwen Response:', content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('HF Qwen extraction failed:', error.message);
    return null;
  }
}


function formatBP(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    // Handle {sys: 120, dia: 80} or {systolic: 120, diastolic: 80}
    const sys = value.sys || value.systolic || value.high || value.systolic_bp;
    const dia = value.dia || value.diastolic || value.low || value.diastolic_bp;
    if (sys && dia) return `${sys}/${dia}`;
  }
  return value.toString();
}

function normalizeVitals(raw) {
  if (!raw) return null;

  const standardKeys = ['HR', 'hr', 'HeartRate', 'Pulse', 'pulse', 'SpO2', 'spo2', 'ABP', 'abp', 'BP', 'PAP', 'pap', 'EtCO2', 'etco2', 'CO2', 'awRR', 'awrr', 'RR'];
  const normalized = {
    HR: raw.HR || raw.hr || raw.HeartRate || null,
    Pulse: raw.Pulse || raw.pulse || null,
    SpO2: raw.SpO2 || raw.spo2 || null,
    ABP: formatBP(raw.ABP || raw.abp || raw.BP),
    PAP: formatBP(raw.PAP || raw.pap),
    EtCO2: raw.EtCO2 || raw.etco2 || raw.CO2 || null,
    awRR: raw.awRR || raw.awrr || raw.RR || null,
    additional_data: {}
  };

  // Collect non-standard keys
  Object.keys(raw).forEach(key => {
    if (!standardKeys.includes(key) && raw[key] !== null) {
      normalized.additional_data[key] = raw[key];
    }
  });

  return normalized;
}

// Routes

// SBAR Summary Endpoint
app.get('/api/patients/:id/sbar', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;
    const { regenerate } = req.query;

    // 1. Fetch Patient Details
    const [patientRows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
    if (patientRows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    const patient = patientRows[0];

    // If we have a stored summary and not regenerating, return it
    if (patient.sbar_summary && regenerate !== 'true') {
      return res.json({ summary: patient.sbar_summary, isStored: true });
    }

    // 2. Fetch last 48 hours of Vitals
    const [vitalRows] = await pool.query(`
            SELECT * FROM vitals 
            WHERE patient_id = ? 
            AND created_at >= NOW() - INTERVAL 48 HOUR 
            ORDER BY created_at DESC
        `, [patientId]);

    // Construct Data Context
    const context = `
            Patient: ${patient.patient_name} (${patient.gender}, ${patient.age}y)
            Diagnosis: ${patient.diagnosis}
            Admission: ${new Date(patient.admission_date).toLocaleDateString()}
            
            Recent Vitals (Last 48h - ${vitalRows.length} records):
            ${vitalRows.slice(0, 15).map(v =>
      `[${new Date(v.created_at).toLocaleString()}] HR:${v.hr} SpO2:${v.spo2} BP:${v.abp}`
    ).join('\n')}
            ... (older records omitted)
        `;

    // 3. Generate Summary with Llama (Groq)
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert medical AI assistant. Create a professional SBAR (Situation, Background, Assessment, Recommendation) summary for the doctor."
        },
        {
          role: "user",
          content: `Generate an SBAR summary for this patient based on the following data:\n${context}`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });

    const sbarSummary = completion.choices[0].message.content;
    res.json({ summary: sbarSummary, isStored: false });

  } catch (error) {
    console.error('SBAR Generation failed:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Save SBAR Summary (Doctors only)
app.put('/api/patients/:id/sbar', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;
    const { summary } = req.body;
    const { role } = req.user;

    if (role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Only doctors can edit clinical summaries' });
    }

    await pool.query('UPDATE patients SET sbar_summary = ? WHERE patient_id = ?', [summary, patientId]);
    res.json({ message: 'Summary saved successfully' });
  } catch (error) {
    console.error('Failed to save SBAR:', error);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save SBAR Summary (Doctors only)
app.put('/api/patients/:id/sbar', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;
    const { summary } = req.body;
    const { role } = req.user;

    if (role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Only doctors can edit clinical summaries' });
    }

    await pool.query('UPDATE patients SET sbar_summary = ? WHERE patient_id = ?', [summary, patientId]);
    res.json({ message: 'Summary saved successfully' });
  } catch (error) {
    console.error('Failed to save SBAR:', error);
    res.status(500).json({ error: 'Database update failed' });
  }
});


// AI Vitals Extraction (Pipeline: Llama -> Qwen -> Tesseract)
app.post('/api/extract-vitals', authenticateToken, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Image data is required' });

    console.log('--- Starting AI Vitals Extraction Pipeline ---');

    // Step 1: Run Llama (Primary)
    const llamaRaw = await extractWithLlama(imageBase64);
    const llamaVitals = normalizeVitals(llamaRaw);

    // Step 2: Run Qwen (Verification/Secondary)
    const qwenRaw = await extractWithQwen(imageBase64);
    const qwenVitals = normalizeVitals(qwenRaw);

    let finalVitals = null;
    let source = 'failed';

    // Pipeline Logic
    if (qwenVitals && llamaVitals) {
      // Compare essential vitals (HR, SpO2)
      const hrMatch = Math.abs((qwenVitals.HR || 0) - (llamaVitals.HR || 0)) < 5;

      if (hrMatch) {
        console.log('Llama and Qwen match. Using verified result.');
        finalVitals = llamaVitals; // Use Llama if match
        source = 'llama-verified';
      } else {
        console.log('Llama and Qwen mismatch. Trusting Qwen (Higher Params).');
        finalVitals = qwenVitals; // Trust Qwen on mismatch
        source = 'qwen-override';
      }
    } else if (qwenVitals) {
      console.log('Only Qwen succeeded.');
      finalVitals = qwenVitals;
      source = 'qwen-only';
    } else if (llamaVitals) {
      console.log('Only Llama succeeded.');
      finalVitals = llamaVitals;
      source = 'llama-only';
    } else {
      console.log('Both AI models failed. Falling back to Tesseract OCR.');
    }

    // Step 3: Tesseract Fallback
    if (!finalVitals) {
      try {
        const ocrText = await Tesseract.recognize(
          Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), 'base64'),
          'eng'
        );
        console.log('Tesseract OCR Text:', ocrText.data.text);
        // Basic parsing logic (simplified for fallback)
        // Ideally, you'd use Regex here to parse the OCR text
        source = 'tesseract-fallback';
        // Return empty structure if parsing not implemented, frontend can handle manual entry
        finalVitals = { HR: null, SpO2: null, ABP: null, Note: "OCR Extraction raw text available - manual check required" };
      } catch (ocrError) {
        console.error('Tesseract fallback failed:', ocrError);
      }
    }

    res.json({ vitals: finalVitals || {}, source });

  } catch (error) {
    console.error('Extraction pipeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Helper function: Extract vitals using Tesseract OCR
async function extractWithTesseract(imageBase64) {
  const { data: { text } } = await Tesseract.recognize(
    imageBase64,
    'eng',
    { logger: m => { } }
  );

  console.log('OCR Text:', text);

  const extract = (regex) => {
    const match = text.match(regex);
    return match ? parseInt(match[1]) : null;
  };

  let vitals = {
    HR: null,
    Pulse: null,
    SpO2: null,
    ABP: null,
    PAP: null,
    EtCO2: null,
    awRR: null
  };

  // HR / Pulse
  vitals.HR = extract(/(?:HR|Heart Rate|BPM|PF)[\s\S]{0,15}?(\d{2,3})/i);
  vitals.Pulse = extract(/(?:Pulse|PR|pode)[\s\S]{0,15}?(\d{2,3})/i);

  // Double number pattern fallback
  if (!vitals.HR && !vitals.Pulse) {
    const doubleMatch = text.match(/(\d{2,3})\s+(\d{2,3})/);
    if (doubleMatch && doubleMatch[1] === doubleMatch[2]) {
      vitals.HR = parseInt(doubleMatch[1]);
      vitals.Pulse = parseInt(doubleMatch[1]);
    }
  }

  // SpO2
  vitals.SpO2 = extract(/(?:SpO2|O2|%|Sat)[\s\S]{0,15}?(\d{2,3})/i);
  if (!vitals.SpO2) {
    const parenMatch = text.match(/\((\d{2,3})\)/);
    if (parenMatch && parseInt(parenMatch[1]) >= 80 && parseInt(parenMatch[1]) <= 100) {
      vitals.SpO2 = parseInt(parenMatch[1]);
    }
  }

  // EtCO2
  vitals.EtCO2 = extract(/(?:EtCO2|CO2|atcoz)[\s\S]{0,15}?(\d{1,3})/i);

  // RR
  vitals.awRR = extract(/(?:RR|Resp|awRR)[\s\S]{0,15}?(\d{1,2})/i);

  // BP
  const bpMatch = text.match(/(?:ABP|BP|NIBP|SY)[\s\S]{0,15}?(\d{2,3})\s*[\/\-\s]\s*(\d{2,3})/i);
  if (bpMatch) {
    vitals.ABP = `${bpMatch[1]}/${bpMatch[2]}`;
  } else {
    const looseBpMatch = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (looseBpMatch) {
      vitals.ABP = `${looseBpMatch[1]}/${looseBpMatch[2]}`;
    }
  }

  // Sync HR/Pulse
  if (vitals.HR && !vitals.Pulse) vitals.Pulse = vitals.HR;
  if (!vitals.HR && vitals.Pulse) vitals.HR = vitals.Pulse;

  return vitals;
}

// Helper function: Extract vitals using Gemini API
async function extractWithGemini(imageBase64) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Convert base64 to proper format for Gemini
  const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `Analyze this medical monitor screen and extract vital signs. Return ONLY a valid JSON object with these exact keys: HR, Pulse, SpO2, ABP, PAP, EtCO2, awRR. Use null for missing values. Format ABP as "sys/dia" (e.g., "120/80"). Do not include any markdown formatting or explanations.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageData,
        mimeType: "image/jpeg"
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();
  console.log('Gemini Response:', text);

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsedVitals = JSON.parse(jsonMatch[0]);
    return {
      HR: parsedVitals.HR || parsedVitals.hr || null,
      Pulse: parsedVitals.Pulse || parsedVitals.pulse || null,
      SpO2: parsedVitals.SpO2 || parsedVitals.spo2 || null,
      ABP: parsedVitals.ABP || parsedVitals.abp || parsedVitals.BP || null,
      PAP: parsedVitals.PAP || parsedVitals.pap || null,
      EtCO2: parsedVitals.EtCO2 || parsedVitals.etco2 || parsedVitals.CO2 || null,
      awRR: parsedVitals.awRR || parsedVitals.awrr || parsedVitals.RR || null
    };
  }

  throw new Error('Failed to parse Gemini response');
}

// Helper function: Choose the best vitals result based on completeness
function chooseBestVitals(tesseractVitals, geminiVitals) {
  // If only one succeeded, use it
  if (!tesseractVitals && geminiVitals) {
    return { ...geminiVitals, source: 'gemini' };
  }
  if (tesseractVitals && !geminiVitals) {
    return { ...tesseractVitals, source: 'tesseract' };
  }
  if (!tesseractVitals && !geminiVitals) {
    return {
      HR: null,
      Pulse: null,
      SpO2: null,
      ABP: null,
      PAP: null,
      EtCO2: null,
      awRR: null,
      source: 'none'
    };
  }

  // Both succeeded - calculate completeness scores
  const scoreVitals = (vitals) => {
    let score = 0;
    if (vitals.HR) score++;
    if (vitals.Pulse) score++;
    if (vitals.SpO2) score++;
    if (vitals.ABP) score++;
    if (vitals.PAP) score++;
    if (vitals.EtCO2) score++;
    if (vitals.awRR) score++;
    return score;
  };

  const tesseractScore = scoreVitals(tesseractVitals);
  const geminiScore = scoreVitals(geminiVitals);

  console.log(`Tesseract score: ${tesseractScore}, Gemini score: ${geminiScore}`);

  // If scores are equal, prefer Gemini 
  if (geminiScore >= tesseractScore) {
    return { ...geminiVitals, source: 'gemini' };
  } else {
    return { ...tesseractVitals, source: 'tesseract' };
  }
}

/**
 * Validates extracted vitals against medically plausible ranges.
 * Values outside these ranges are set to null.
 * @param {Object} vitals - The extracted vitals object
 * @returns {Object} - The validated vitals object
 */
function validateExtractedVitals(vitals) {
  if (!vitals) return null;

  const validated = { ...vitals };

  // HR and Pulse: 30-250 BPM
  if (validated.HR && (validated.HR < 30 || validated.HR > 160)) validated.HR = null;
  if (validated.Pulse && (validated.Pulse < 30 || validated.Pulse > 250)) validated.Pulse = null;

  // SpO2: 50-100%
  if (validated.SpO2 && (validated.SpO2 < 50 || validated.SpO2 > 100)) validated.SpO2 = null;

  // EtCO2: 10-100 mmHg
  if (validated.EtCO2 && (validated.EtCO2 < 10 || validated.EtCO2 > 100)) validated.EtCO2 = null;

  // awRR: 4-60 /min
  if (validated.awRR && (validated.awRR < 4 || validated.awRR > 60)) validated.awRR = null;

  // BP validation (regex check + numerical range)
  if (validated.ABP) {
    if (!/^\d{2,3}[/]\d{2,3}$/.test(validated.ABP)) {
      // Try to sanitize if it's almost correct (e.g., uses space or dash)
      const sanitizedMatch = validated.ABP.match(/(\d{2,3})[\s\-]+(\d{2,3})/);
      if (sanitizedMatch) {
        validated.ABP = `${sanitizedMatch[1]}/${sanitizedMatch[2]}`;
      } else {
        validated.ABP = null;
      }
    }

    // Numerical range check for ABP
    if (validated.ABP) {
      const [sys, dia] = validated.ABP.split('/').map(Number);
      if (sys < 30 || sys > 300 || dia < 10 || dia > 200) {
        validated.ABP = null;
      }
    }
  }

  // PAP validation
  if (validated.PAP) {
    if (!/^\d{1,3}[/]\d{1,3}$/.test(validated.PAP)) {
      validated.PAP = null;
    }

    // Numerical range check for PAP
    if (validated.PAP) {
      const [sys, dia] = validated.PAP.split('/').map(Number);
      if (sys < 5 || sys > 120 || dia < 2 || dia > 80) {
        validated.PAP = null;
      }
    }
  }

  return validated;
}

// Save Vitals
app.post('/api/vitals', authenticateToken, async (req, res) => {
  try {
    const vitalsData = req.body;
    const hospitalId = req.user.hospital_id;
    const vitalsArray = Array.isArray(vitalsData) ? vitalsData : [vitalsData];

    if (vitalsArray.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const vital of vitalsArray) {
        const query = `
          INSERT INTO vitals 
          (patient_id, hr, pulse, spo2, abp, pap, etco2, awrr, source, additional_data, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Default to patient_id 1 if not provided, to avoid NOT NULL constraint error
        const patientId = vital.patient_id || 1;

        const values = [
          patientId,
          (vital.hr && vital.hr > 0 && vital.hr < 300) ? vital.hr : null,
          (vital.pulse && vital.pulse > 0 && vital.pulse < 300) ? vital.pulse : null,
          (vital.spo2 && vital.spo2 > 0 && vital.spo2 <= 100) ? vital.spo2 : null,
          vital.abp || null,
          vital.pap || null,
          vital.etco2 || null,
          vital.awrr || null,
          vital.source || 'manual',
          JSON.stringify(vital.additional_data || {}),
          vital.created_at ? new Date(vital.created_at) : new Date()
        ];

        await connection.query(query, values);

        // Emit real-time update with complete vital data
        const completeVital = {
          patient_id: patientId,
          hr: values[1],
          pulse: values[2],
          spo2: values[3],
          abp: values[4],
          pap: values[5],
          etco2: values[6],
          awrr: values[7],
          source: values[8],
          additional_data: vital.additional_data || {},
          created_at: values[10]
        };

        console.log('Emitting vital update:', completeVital);
        io.emit('vital-update', completeVital);
        if (patientId) {
          io.to(`patient-${patientId}`).emit('vital-update', completeVital);

          // Check for alerts and email doctor
          checkAndAlert(completeVital, patientId).catch(err => console.error('Error in alert check:', err));
        }
      }

      await connection.commit();
      res.status(201).json({ message: 'Vitals saved successfully', count: vitalsArray.length });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error saving vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ICUs
app.get('/api/icus', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const [rows] = await pool.query('SELECT * FROM icus WHERE hospital_id = ? ORDER BY icu_name', [hospitalId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ICUs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create ICU
app.post('/api/icus', authenticateToken, async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    const { icu_name, location } = req.body;
    if (!icu_name) {
      return res.status(400).json({ error: 'ICU Name is required' });
    }
    const [result] = await pool.query('INSERT INTO icus (icu_name, location, hospital_id) VALUES (?, ?, ?)', [icu_name, location, hospitalId]);
    const newIcuId = result.insertId;

    // Seed 10 beds for the new ICU automatically
    const bedValues = [];
    for (let i = 1; i <= 10; i++) {
      bedValues.push([newIcuId, `${i}`, null]);
    }
    if (bedValues.length > 0) {
      await pool.query('INSERT INTO beds (icu_id, bed_number, patient_id) VALUES ?', [bedValues]);
      console.log(`Seeded 10 beds for new ICU #${newIcuId}`);
    }

    res.status(201).json({ message: 'ICU created', icuId: newIcuId });
  } catch (error) {
    console.error('Error creating ICU:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'ICU Name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Schedule Daily Data Summarization & Cleanup (Run at midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily vital summarization and cleanup...');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Summarize data older than 24 hours
    const summaryQuery = `
      INSERT INTO daily_vital_summaries 
      (patient_id, summary_date, hr_min, hr_max, pulse_min, pulse_max, spo2_min, spo2_max, etco2_min, etco2_max, awrr_min, awrr_max)
      SELECT 
        patient_id, 
        DATE(created_at) as summary_date,
        MIN(hr) as hr_min, MAX(hr) as hr_max,
        MIN(pulse) as pulse_min, MAX(pulse) as pulse_max,
        MIN(spo2) as spo2_min, MAX(spo2) as spo2_max,
        MIN(etco2) as etco2_min, MAX(etco2) as etco2_max,
        MIN(awrr) as awrr_min, MAX(awrr) as awrr_max
      FROM vitals
      WHERE created_at < NOW() - INTERVAL 1 DAY
      GROUP BY patient_id, DATE(created_at)
      ON DUPLICATE KEY UPDATE
        hr_min = LEAST(hr_min, VALUES(hr_min)), hr_max = GREATEST(hr_max, VALUES(hr_max)),
        pulse_min = LEAST(pulse_min, VALUES(pulse_min)), pulse_max = GREATEST(pulse_max, VALUES(pulse_max)),
        spo2_min = LEAST(spo2_min, VALUES(spo2_min)), spo2_max = GREATEST(spo2_max, VALUES(spo2_max)),
        etco2_min = LEAST(etco2_min, VALUES(etco2_min)), etco2_max = GREATEST(etco2_max, VALUES(etco2_max)),
        awrr_min = LEAST(awrr_min, VALUES(awrr_min)), awrr_max = GREATEST(awrr_max, VALUES(awrr_max));
    `;

    // We use ON DUPLICATE KEY UPDATE in case the cron runs multiple times or overlaps, updating the summary.
    // Ideally we are processing specific old records, but simple Group By Day is safer.

    await connection.query(summaryQuery);
    console.log('Summarization complete.');

    // 2. Delete raw data older than 24 hours
    // NOTE: This permanently removes detailed records.
    const [deleteResult] = await connection.query('DELETE FROM vitals WHERE created_at < NOW() - INTERVAL 1 DAY');
    console.log(`Cleanup complete. Deleted ${deleteResult.affectedRows} old vital records.`);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Error during data cleanup:', error);
  } finally {
    connection.release();
  }
});

// Test Alert Route
app.get('/api/test/alert/:patientId', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.patientId;
    // Mock vitals that will trigger alerts (Pulse > 100, SpO2 < 90)
    const mockVitals = {
      hr: 110,
      pulse: 115,
      spo2: 85,
      etco2: 40,
      awrr: 16
    };

    // Clear state map for this patient to ensure alert is sent (Normal -> High/Low)
    vitalStateMap.delete(`${patientId}-Pulse`);
    vitalStateMap.delete(`${patientId}-SpO2`);
    vitalStateMap.delete(`${patientId}-HR`);

    await checkAndAlert(mockVitals, patientId);
    res.json({ message: 'Test alert triggered. Check server console for email logs.' });
  } catch (error) {
    console.error('Test alert failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start Server
// Export app for Vercel
export default app;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Delete ICU
app.delete('/api/icus/:id', authenticateToken, async (req, res) => {
  try {
    const icuId = req.params.id;
    const hospitalId = req.user.hospital_id;

    // Verify ownership
    const [check] = await pool.query('SELECT icu_id FROM icus WHERE icu_id = ? AND hospital_id = ?', [icuId, hospitalId]);
    if (check.length === 0) {
      return res.status(404).json({ error: 'ICU not found or unauthorized' });
    }

    const [result] = await pool.query('DELETE FROM icus WHERE icu_id = ?', [icuId]);
    res.json({ message: 'ICU deleted successfully' });
  } catch (error) {
    console.error('Error deleting ICU:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




