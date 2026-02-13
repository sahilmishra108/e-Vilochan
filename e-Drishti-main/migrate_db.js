
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, 'server/.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vitalview',
});

async function migrate() {
    try {
        console.log('Starting migration...');
        const connection = await pool.getConnection();

        // Check if columns exist
        const [columns] = await connection.query("SHOW COLUMNS FROM doctors LIKE 'role'");
        if (columns.length === 0) {
            console.log("Adding 'role' column...");
            await connection.query("ALTER TABLE doctors ADD COLUMN role ENUM('admin', 'doctor', 'staff') DEFAULT 'admin' AFTER password");
        } else {
            console.log("'role' column already exists.");
        }

        const [icuColumns] = await connection.query("SHOW COLUMNS FROM doctors LIKE 'assigned_icu_id'");
        if (icuColumns.length === 0) {
            console.log("Adding 'assigned_icu_id' column...");
            await connection.query("ALTER TABLE doctors ADD COLUMN assigned_icu_id INT AFTER role");
            await connection.query("ALTER TABLE doctors ADD CONSTRAINT fk_assigned_icu FOREIGN KEY (assigned_icu_id) REFERENCES icus(icu_id) ON DELETE SET NULL");
        } else {
            console.log("'assigned_icu_id' column already exists.");
        }

        console.log('Migration completed successfully.');
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
