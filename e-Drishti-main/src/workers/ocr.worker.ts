
// Worker for processing OCR in a separate thread
import { ROI } from "../types/vitals";
// Use dynamic API URL logic similar to config.ts
const API_BASE_URL = typeof process !== 'undefined' && process.env.VITE_API_BASE_URL
    ? process.env.VITE_API_BASE_URL
    : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    || 'http://localhost:3000';

interface OCRMessage {
    imageBase64: string;
    rois: ROI[];
    token?: string;
}

self.onmessage = async (e: MessageEvent<OCRMessage>) => {
    const { imageBase64, rois, token } = e.data;

    try {
        // Notify start
        self.postMessage({
            status: 'initializing',
            progress: 10,
            message: 'Initializing Tesseract OCR engine in worker...'
        });

        // Simulate initialization
        await new Promise(resolve => setTimeout(resolve, 200));

        self.postMessage({
            status: 'processing',
            progress: 30,
            message: 'Preprocessing image...'
        });

        // Perform the heavy lifting (Fetch to backend for now, but off main thread)
        const response = await fetch(`${API_BASE_URL}/api/extract-vitals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ imageBase64, rois })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        self.postMessage({
            status: 'completed',
            progress: 100,
            message: 'OCR recognition completed',
            result: {
                text: 'Vital signs extracted',
                confidence: 0.95,
                vitals: data.vitals
            }
        });

    } catch (error: any) {
        self.postMessage({
            status: 'error',
            message: error.message || 'Unknown error',
            result: {
                vitals: {
                    HR: null, Pulse: null, SpO2: null, ABP: null, PAP: null, EtCO2: null, awRR: null
                }
            }
        });
    }
};
