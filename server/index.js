import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { HfInference } from '@huggingface/inference';
import Tesseract from 'tesseract.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, 'config.env');
const envPath = fs.existsSync(configPath) ? configPath : path.resolve(__dirname, '.env');
console.log('Loading environment from:', envPath);

dotenv.config({ path: envPath });

console.log('--- Environment Check ---');
console.log('HF_ACCESS_TOKEN present:', !!process.env.HF_ACCESS_TOKEN);
if (process.env.HF_ACCESS_TOKEN) {
  console.log('HF_ACCESS_TOKEN prefix:', process.env.HF_ACCESS_TOKEN.substring(0, 3));
  if (!process.env.HF_ACCESS_TOKEN.startsWith('hf_')) {
    console.warn('WARNING: HF_ACCESS_TOKEN does not start with "hf_". This may cause issues with the Hugging Face Inference API.');
  }
} else {
  console.warn('WARNING: HF_ACCESS_TOKEN is missing. Hugging Face VLM extraction will likely fail.');
}
console.log('-------------------------');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
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

// Alert Thresholds & Rate Limiting
const ALERT_RANGES = {
  HR: { low: 60, high: 100 },
  Pulse: { low: 60, high: 100 },
  SpO2: { low: 90, high: 100 },
  EtCO2: { low: 35, high: 45 },
  awRR: { low: 12, high: 20 }
};

// Rate limiting: Map<"patientId-vitalType", timestamp>
const lastAlertTime = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

async function checkAndAlert(vital, patientId) {
  const alerts = [];

  const check = (type, value, range) => {
    if (value !== null && (value < range.low || value > range.high)) {
      alerts.push({ type, value, condition: value < range.low ? 'Low' : 'High' });
    }
  };

  check('HR', vital.hr, ALERT_RANGES.HR);
  check('Pulse', vital.pulse, ALERT_RANGES.Pulse);
  check('SpO2', vital.spo2, ALERT_RANGES.SpO2);
  check('EtCO2', vital.etco2, ALERT_RANGES.EtCO2);
  check('awRR', vital.awrr, ALERT_RANGES.awRR);

  if (alerts.length === 0) return;

  // Fetch Patient Name
  let patientName = 'Unknown Patient';
  try {
    const [rows] = await pool.query('SELECT patient_name FROM patients WHERE patient_id = ?', [patientId]);
    if (rows.length > 0) {
      patientName = rows[0].patient_name;
    }
  } catch (err) {
    console.error('Error fetching patient name for alert:', err);
  }

  for (const alert of alerts) {
    const key = `${patientId}-${alert.type}`;
    const now = Date.now();
    const lastTime = lastAlertTime.get(key) || 0;

    if (now - lastTime > ALERT_COOLDOWN) {
      // Send Email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: DOCTOR_EMAIL,
        subject: `ALERT: ${patientName} (ID: ${patientId}) - ${alert.type} ${alert.condition}`,
        text: `CRITICAL VITAL SIGN ALERT\n\n` +
          `Patient Name: ${patientName}\n` +
          `Patient ID:   ${patientId}\n\n` +
          `Vital Sign:   ${alert.type}\n` +
          `Status:       ${alert.condition} (${alert.value})\n` +
          `Timestamp:    ${new Date().toLocaleString()}\n` +
          `Please attend to the patient immediately.`
      };

      try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Alert email sent for Patient ${patientId} (${patientName}) - ${alert.type}`);
        lastAlertTime.set(key, now);
      } catch (error) {
        console.error('Failed to send alert email:', error);
      }
    }
  }
}

// Test DB Connection
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
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

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-patient', (patientId) => {
    socket.join(`patient-${patientId}`);
    console.log(`Socket ${socket.id} joined patient-${patientId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Routes

// Health Check
app.get('/', (req, res) => {
  res.send('VitalView Server is running');
});

// Get All Patients
app.get('/api/patients', async (req, res) => {
  try {
    const [rows] = await pool.query(`
            SELECT p.*, b.bed_id 
            FROM patients p 
            LEFT JOIN beds b ON p.patient_id = b.patient_id 
            ORDER BY p.patient_name
        `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Single Patient
app.get('/api/patients/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add New Patient
app.post('/api/patients', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { patient_name, age, gender, diagnosis, admission_date } = req.body;

    if (!patient_name || !age || !gender || !diagnosis || !admission_date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // 1. Insert the new patient
    const query = `
            INSERT INTO patients (patient_name, age, gender, diagnosis, admission_date)
            VALUES (?, ?, ?, ?, ?)
        `;
    const [result] = await connection.query(query, [patient_name, age, gender, diagnosis, admission_date]);
    const newPatientId = result.insertId;

    // 2. Find the first available bed (where patient_id is NULL)
    const [availableBeds] = await connection.query('SELECT bed_id FROM beds WHERE patient_id IS NULL LIMIT 1');

    let assignedBedId = null;
    if (availableBeds.length > 0) {
      assignedBedId = availableBeds[0].bed_id;
      // 3. Assign the bed to the new patient
      await connection.query('UPDATE beds SET patient_id = ? WHERE bed_id = ?', [newPatientId, assignedBedId]);
      console.log(`Assigned Bed #${assignedBedId} to new Patient #${newPatientId}`);
    } else {
      console.log(`No available beds for new Patient #${newPatientId}`);
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
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const patientId = req.params.id;

    // First check if patient exists
    const [check] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
    if (check.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
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
app.get('/api/beds', async (req, res) => {
  try {
    const query = `
      SELECT b.*, p.patient_name 
      FROM beds b 
      LEFT JOIN patients p ON b.patient_id = p.patient_id
      ORDER BY b.bed_number
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Vitals (General or Patient Specific)
app.get('/api/vitals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const [rows] = await pool.query('SELECT * FROM vitals ORDER BY created_at DESC LIMIT ?', [limit]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/vitals/:patientId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const [rows] = await pool.query(
      'SELECT * FROM vitals WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?',
      [req.params.patientId, limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Vital Record
app.delete('/api/vitals/:id', async (req, res) => {
  try {
    const vitalId = req.params.id;
    if (!vitalId) {
      return res.status(400).json({ error: 'Vital ID is required' });
    }

    const [result] = await pool.query('DELETE FROM vitals WHERE vital_id = ?', [vitalId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vital record not found' });
    }

    res.json({ message: 'Vital record deleted successfully' });
  } catch (error) {
    console.error('Error deleting vital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete All Vitals (with optional patient_id)
app.delete('/api/vitals', async (req, res) => {
  try {
    const { patientId } = req.query;
    let query = 'DELETE FROM vitals';
    let params = [];

    if (patientId) {
      query += ' WHERE patient_id = ?';
      params.push(patientId);
    }

    await pool.query(query, params);

    res.json({ message: 'All vitals deleted successfully' });
  } catch (error) {
    console.error('Error deleting all vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Extract Vitals (Hugging Face VLM + Tesseract + Gemini Fallback)
app.post('/api/extract-vitals', async (req, res) => {
  try {
    const { imageBase64, rois } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    console.log('Processing extraction request...');

    let vitals = {
      HR: null,
      Pulse: null,
      SpO2: null,
      ABP: null,
      PAP: null,
      EtCO2: null,
      awRR: null
    };

    // 1. Try Hugging Face Vision-Language Model first
    try {
      console.log('Attempting Hugging Face VLM extraction...');

      const response = await hf.chatCompletion({
        model: "Qwen/Qwen2.5-VL-7B-Instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a medical vital signs extraction AI. Analyze this medical patient monitor screen image carefully.

TASK: Extract the following vital signs from the monitor display:
- HR (Heart Rate): Usually displayed in BPM (beats per minute), typically 60-100
- Pulse: Often the same as HR, displayed in BPM
- SpO2 (Oxygen Saturation): Displayed as percentage (%), typically 95-100%
- ABP (Arterial Blood Pressure): Format as "systolic/diastolic" (e.g., "120/80")
- PAP (Pulmonary Artery Pressure): Format as "systolic/diastolic" if available
- EtCO2 (End-Tidal CO2): Displayed in mmHg, typically 35-45
- awRR (Airway Respiratory Rate): Breaths per minute, typically 12-20

INSTRUCTIONS:
1. Look for large numbers on the monitor - these are usually the main vital signs
2. HR and Pulse are often displayed together and may have the same value
3. SpO2 is often shown with a % symbol or in parentheses like (98)
4. Blood pressure (ABP) is shown as two numbers separated by a slash (e.g., 120/80)
5. Numbers near waveforms usually indicate the vital sign for that waveform
6. If a value is not visible or unclear, set it to null

OUTPUT FORMAT:
Return ONLY a valid JSON object with these exact keys. Do not include any markdown, code blocks, or explanations:
{
  "HR": <number or null>,
  "Pulse": <number or null>,
  "SpO2": <number or null>,
  "ABP": "<systolic>/<diastolic>" or null,
  "PAP": "<systolic>/<diastolic>" or null,
  "EtCO2": <number or null>,
  "awRR": <number or null>
}

Example valid output:
{"HR": 75, "Pulse": 75, "SpO2": 98, "ABP": "120/80", "PAP": null, "EtCO2": 38, "awRR": 16}`
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
      console.log('HF VLM Response:', content);

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedVitals = JSON.parse(jsonMatch[0]);
        // Normalize keys and merge
        vitals = {
          HR: parsedVitals.HR || parsedVitals.hr || null,
          Pulse: parsedVitals.Pulse || parsedVitals.pulse || null,
          SpO2: parsedVitals.SpO2 || parsedVitals.spo2 || null,
          ABP: parsedVitals.ABP || parsedVitals.abp || parsedVitals.BP || null,
          PAP: parsedVitals.PAP || parsedVitals.pap || null,
          EtCO2: parsedVitals.EtCO2 || parsedVitals.etco2 || parsedVitals.CO2 || null,
          awRR: parsedVitals.awRR || parsedVitals.awrr || parsedVitals.RR || null
        };
        console.log('Successfully extracted vitals using Hugging Face.');
        return res.json({ vitals, source: 'huggingface' });
      }
    } catch (hfError) {
      console.error('Hugging Face VLM failed, falling back to Tesseract + Gemini:', hfError.message);
    }

    // 2. Fallback: Run both Tesseract and Gemini in parallel
    console.log('Running Tesseract and Gemini in parallel...');

    const [tesseractResult, geminiResult] = await Promise.allSettled([
      extractWithTesseract(imageBase64),
      extractWithGemini(imageBase64)
    ]);

    let tesseractVitals = null;
    let geminiVitals = null;

    if (tesseractResult.status === 'fulfilled') {
      tesseractVitals = tesseractResult.value;
      console.log('Tesseract Vitals:', tesseractVitals);
    } else {
      console.error('Tesseract failed:', tesseractResult.reason);
    }

    if (geminiResult.status === 'fulfilled') {
      geminiVitals = geminiResult.value;
      console.log('Gemini Vitals:', geminiVitals);
    } else {
      console.error('Gemini failed:', geminiResult.reason);
    }

    // 3. Choose the best result based on completeness
    vitals = chooseBestVitals(tesseractVitals, geminiVitals);

    console.log('Final Selected Vitals:', vitals);
    res.json({ vitals, source: vitals.source || 'fallback' });

  } catch (error) {
    console.error('Error extracting vitals:', error);
    res.status(500).json({ error: 'Internal server error during extraction' });
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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

// Save Vitals
app.post('/api/vitals', async (req, res) => {
  try {
    const vitalsData = req.body;

    // Handle both single object and array
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
          (patient_id, hr, pulse, spo2, abp, pap, etco2, awrr, source, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          created_at: values[9]
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

// Start Server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




