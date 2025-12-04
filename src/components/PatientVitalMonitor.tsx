import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

interface VitalRecord {
    patient_id?: number;
    created_at: string;
    hr: number | null;
    pulse: number | null;
    spo2: number | null;
    etco2: number | null;
    abp: string | null;
    pap: string | null;
    awrr: number | null;
}

interface PatientInfo {
    patient_id: number;
    patient_name: string;
}

export interface VitalAlert {
    id: string;
    patientId: number;
    vital: string;
    value: string | number;
    type: 'high' | 'low';
    severity: 'warning' | 'critical';
    timestamp: string;
    source?: 'camera' | 'video';
}

interface PatientVitalMonitorProps {
    vitals: VitalRecord[];
    patient: PatientInfo | null;
}

// Normal ranges for vitals based on medical standards
const VITAL_RANGES = {
    HR: { low: 60, high: 100, criticalLow: 50, criticalHigh: 120 },
    Pulse: { low: 60, high: 100, criticalLow: 50, criticalHigh: 120 },
    SpO2: { low: 90, high: 100, criticalLow: 85, criticalHigh: 100 },
    ABP_Sys: { low: 90, high: 120, criticalLow: 70, criticalHigh: 180 },
    PAP_Dia: { low: 4, high: 12, criticalLow: 2, criticalHigh: 20 },
    EtCO2: { low: 35, high: 45, criticalLow: 25, criticalHigh: 55 },
    awRR: { low: 12, high: 20, criticalLow: 8, criticalHigh: 25 },
};

// Store notifications per patient in memory (simple: current alerts only)
const patientNotifications = new Map<number, VitalAlert[]>();
const listeners = new Set<() => void>();

export const subscribeToNotifications = (callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const notifyListeners = () => {
    listeners.forEach(listener => listener());
};

const PatientVitalMonitor = ({ vitals, patient }: PatientVitalMonitorProps) => {
    // Start from 0 so the initial latestVital is processed when component mounts
    const lastCheckTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!patient || vitals.length === 0) return;

        const latestVital = vitals[vitals.length - 1];
        console.debug('[PatientVitalMonitor] checking latestVital', patient.patient_id, latestVital);
        const patientId = patient.patient_id;

        // Only check vitals that are newer than our last check
        const vitalTime = new Date(latestVital.created_at).getTime();
        if (vitalTime <= lastCheckTimeRef.current) return;

        lastCheckTimeRef.current = vitalTime;

        const newAlerts: VitalAlert[] = [];

        // Check HR
        if (latestVital.hr !== null) {
            if (latestVital.hr < VITAL_RANGES.HR.low || latestVital.hr > VITAL_RANGES.HR.high) {
                const alertId = `${patientId}-hr-${latestVital.created_at}`;
                // Unique alert for this timestamp. Keep once per timestamp.
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'HR',
                        value: latestVital.hr,
                        type: latestVital.hr < VITAL_RANGES.HR.low ? 'low' : 'high',
                        severity: latestVital.hr < VITAL_RANGES.HR.criticalLow || latestVital.hr > VITAL_RANGES.HR.criticalHigh ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Check Pulse
        if (latestVital.pulse !== null) {
            if (latestVital.pulse < VITAL_RANGES.Pulse.low || latestVital.pulse > VITAL_RANGES.Pulse.high) {
                const alertId = `${patientId}-pulse-${latestVital.created_at}`;
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'Pulse',
                        value: latestVital.pulse,
                        type: latestVital.pulse < VITAL_RANGES.Pulse.low ? 'low' : 'high',
                        severity: latestVital.pulse < VITAL_RANGES.Pulse.criticalLow || latestVital.pulse > VITAL_RANGES.Pulse.criticalHigh ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Check SpO2
        if (latestVital.spo2 !== null) {
            if (latestVital.spo2 < VITAL_RANGES.SpO2.low) {
                const alertId = `${patientId}-spo2-${latestVital.created_at}`;
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'SpO2',
                        value: latestVital.spo2,
                        type: 'low',
                        severity: latestVital.spo2 < VITAL_RANGES.SpO2.criticalLow ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Check ABP Sys
        if (latestVital.abp) {
            const abpSys = parseInt(latestVital.abp.split('/')[0]);
            if (!isNaN(abpSys) && (abpSys < VITAL_RANGES.ABP_Sys.low || abpSys > VITAL_RANGES.ABP_Sys.high)) {
                const alertId = `${patientId}-abp-${latestVital.created_at}`;
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'ABP Sys',
                        value: abpSys,
                        type: abpSys < VITAL_RANGES.ABP_Sys.low ? 'low' : 'high',
                        severity: abpSys < VITAL_RANGES.ABP_Sys.criticalLow || abpSys > VITAL_RANGES.ABP_Sys.criticalHigh ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Check PAP Dia
        if (latestVital.pap) {
            const papDia = parseInt(latestVital.pap.split('/')[1]);
            if (!isNaN(papDia) && (papDia < VITAL_RANGES.PAP_Dia.low || papDia > VITAL_RANGES.PAP_Dia.high)) {
                const alertId = `${patientId}-pap-${latestVital.created_at}`;
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'PAP Dia',
                        value: papDia,
                        type: papDia < VITAL_RANGES.PAP_Dia.low ? 'low' : 'high',
                        severity: papDia < VITAL_RANGES.PAP_Dia.criticalLow || papDia > VITAL_RANGES.PAP_Dia.criticalHigh ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Check EtCO2
        if (latestVital.etco2 !== null) {
            if (latestVital.etco2 < VITAL_RANGES.EtCO2.low || latestVital.etco2 > VITAL_RANGES.EtCO2.high) {
                const alertId = `${patientId}-etco2-${latestVital.created_at}`;
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'EtCO2',
                        value: latestVital.etco2,
                        type: latestVital.etco2 < VITAL_RANGES.EtCO2.low ? 'low' : 'high',
                        severity: latestVital.etco2 < VITAL_RANGES.EtCO2.criticalLow || latestVital.etco2 > VITAL_RANGES.EtCO2.criticalHigh ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Check awRR
        if (latestVital.awrr !== null) {
            if (latestVital.awrr < VITAL_RANGES.awRR.low || latestVital.awrr > VITAL_RANGES.awRR.high) {
                const alertId = `${patientId}-awrr-${latestVital.created_at}`;
                if (!newAlerts.some(a => a.id === alertId)) {
                    newAlerts.push({
                        id: alertId,
                        patientId,
                        vital: 'awRR',
                        value: latestVital.awrr,
                        type: latestVital.awrr < VITAL_RANGES.awRR.low ? 'low' : 'high',
                        severity: latestVital.awrr < VITAL_RANGES.awRR.criticalLow || latestVital.awrr > VITAL_RANGES.awRR.criticalHigh ? 'critical' : 'warning',
                        timestamp: latestVital.created_at,
                    });
                }
            }
        }

        // Store alerts for this patient 
        if (newAlerts.length > 0) {
            patientNotifications.set(patientId, newAlerts);
            notifyListeners();
        } else {
            // Clear any existing alerts if newAlerts is empty
            if (patientNotifications.has(patientId)) {
                patientNotifications.delete(patientId);
                notifyListeners();
            }
        }
    }, [vitals, patient]);

    // Setup socket listener for server-generated alerts
    useEffect(() => {
        if (!patient) return;

        const socket = io('http://localhost:3000');
        socket.emit('join-patient', patient.patient_id);

        const onVitalAlert = (alert: VitalAlert) => {
            if (alert && alert.patientId === patient.patient_id) {
                addManualAlert(patient.patient_id, alert);
            }
        };

        socket.on('vital-alert', onVitalAlert);

        return () => {
            socket.off('vital-alert', onVitalAlert);
            socket.disconnect();
        };
    }, [patient]);

    // This component doesn't render anything - it just monitors vitals
    return null;
};

// Export function to get notifications for a specific patient
export const getPatientNotifications = (patientId: number): VitalAlert[] => {
    return patientNotifications.get(patientId) || [];
};

// Export function to clear notifications for a specific patient
export const clearPatientNotifications = (patientId: number): void => {
    patientNotifications.delete(patientId);
    notifyListeners();
};

export const getAllNotifications = (): VitalAlert[] => {
    // Global notifications are intentionally disabled — we only show per-patient alerts
    return [];
};

export const addManualAlert = (patientId: number, alert: VitalAlert) => {
    const existingAlerts = patientNotifications.get(patientId) || [];
    patientNotifications.set(patientId, [...existingAlerts, alert]);
    notifyListeners();
};

export default PatientVitalMonitor;
