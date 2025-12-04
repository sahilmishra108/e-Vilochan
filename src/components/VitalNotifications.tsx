import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Bell, AlertTriangle, TrendingUp, TrendingDown, X } from 'lucide-react';


interface VitalRecord {
  created_at: string;
  hr: number | null;
  pulse: number | null;
  spo2: number | null;
  etco2: number | null;
  abp: string | null;
  pap: string | null;
  awrr: number | null;
  patient_id?: number;
}

interface PatientInfo {
  patient_id: number;
  patient_name: string;
}

interface VitalAlert {
  id: string;
  type: 'high' | 'low';
  vital: string;
  value: string | number;
  timestamp: string;
  severity: 'warning' | 'critical';
}

// Normal ranges for vitals based on medical standards
const VITAL_RANGES = {
  HR: { min: 60, max: 100, low: 60, high: 100 },
  Pulse: { min: 60, max: 100, low: 60, high: 100 },
  SpO2: { min: 95, max: 100, low: 90, high: 100 },
  ABP_Sys: { min: 90, max: 120, low: 90, high: 120 },
  PAP_Dia: { min: 4, max: 12, low: 4, high: 12 },
  EtCO2: { min: 35, max: 45, low: 35, high: 45 },
  awRR: { min: 12, max: 20, low: 12, high: 20 },
};

interface VitalNotificationsProps {
  vitals: VitalRecord[];
  patient?: PatientInfo | null;
}

const VitalNotifications = ({ vitals, patient }: VitalNotificationsProps) => {
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const alarmAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previousAlertIdsRef = React.useRef<Set<string>>(new Set());



  useEffect(() => {
    if (vitals.length === 0) return;

    // API returns vitals in DESC order (newest first), so vitals[0] is the latest
    const latestVital = vitals[0];
    const newAlerts: VitalAlert[] = [];

    console.log('[VitalNotifications] Checking vitals:', latestVital);
    console.log('[VitalNotifications] Total vitals:', vitals.length);

    // Check HR (< 60 low, 60-100 normal, > 100 high)
    if (latestVital.hr !== null) {
      console.log('[VitalNotifications] HR:', latestVital.hr, 'Range:', VITAL_RANGES.HR);
      if (latestVital.hr < VITAL_RANGES.HR.low || latestVital.hr > VITAL_RANGES.HR.high) {
        newAlerts.push({
          id: `hr-${latestVital.created_at}`,
          type: latestVital.hr < VITAL_RANGES.HR.low ? 'low' : 'high',
          vital: 'HR',
          value: latestVital.hr,
          timestamp: latestVital.created_at,
          severity: latestVital.hr < 50 || latestVital.hr > 120 ? 'critical' : 'warning',
        });
      }
    }

    // Check Pulse (< 60 low, 60-100 normal, > 100 high)
    if (latestVital.pulse !== null) {
      if (latestVital.pulse < VITAL_RANGES.Pulse.low || latestVital.pulse > VITAL_RANGES.Pulse.high) {
        newAlerts.push({
          id: `pulse-${latestVital.created_at}`,
          type: latestVital.pulse < VITAL_RANGES.Pulse.low ? 'low' : 'high',
          vital: 'Pulse',
          value: latestVital.pulse,
          timestamp: latestVital.created_at,
          severity: latestVital.pulse < 50 || latestVital.pulse > 120 ? 'critical' : 'warning',
        });
      }
    }

    // Check SpO2 (< 90 low, 95-100 normal, 100% is max - no high alert)
    if (latestVital.spo2 !== null) {
      if (latestVital.spo2 < VITAL_RANGES.SpO2.low) {
        newAlerts.push({
          id: `spo2-${latestVital.created_at}`,
          type: 'low',
          vital: 'SpO2',
          value: latestVital.spo2,
          timestamp: latestVital.created_at,
          severity: latestVital.spo2 < 85 ? 'critical' : 'warning',
        });
      }
    }

    // Check ABP Sys (< 90 low, 90-120 normal, > 120 high)
    if (latestVital.abp) {
      const abpSys = parseInt(latestVital.abp.split('/')[0]);
      if (!isNaN(abpSys)) {
        if (abpSys < VITAL_RANGES.ABP_Sys.low || abpSys > VITAL_RANGES.ABP_Sys.high) {
          newAlerts.push({
            id: `abp-${latestVital.created_at}`,
            type: abpSys < VITAL_RANGES.ABP_Sys.low ? 'low' : 'high',
            vital: 'ABP Sys',
            value: abpSys,
            timestamp: latestVital.created_at,
            severity: abpSys < 70 || abpSys > 180 ? 'critical' : 'warning',
          });
        }
      }
    }

    // Check PAP Dia (< 4 low, 4-12 normal, > 12 high)
    if (latestVital.pap) {
      const papDia = parseInt(latestVital.pap.split('/')[1]);
      if (!isNaN(papDia)) {
        if (papDia < VITAL_RANGES.PAP_Dia.low || papDia > VITAL_RANGES.PAP_Dia.high) {
          newAlerts.push({
            id: `pap-${latestVital.created_at}`,
            type: papDia < VITAL_RANGES.PAP_Dia.low ? 'low' : 'high',
            vital: 'PAP Dia',
            value: papDia,
            timestamp: latestVital.created_at,
            severity: papDia < 2 || papDia > 20 ? 'critical' : 'warning',
          });
        }
      }
    }

    // Check EtCO2 (< 35 low, 35-45 normal, > 45 high)
    if (latestVital.etco2 !== null) {
      if (latestVital.etco2 < VITAL_RANGES.EtCO2.low || latestVital.etco2 > VITAL_RANGES.EtCO2.high) {
        newAlerts.push({
          id: `etco2-${latestVital.created_at}`,
          type: latestVital.etco2 < VITAL_RANGES.EtCO2.low ? 'low' : 'high',
          vital: 'EtCO2',
          value: latestVital.etco2,
          timestamp: latestVital.created_at,
          severity: latestVital.etco2 < 25 || latestVital.etco2 > 55 ? 'critical' : 'warning',
        });
      }
    }

    // Check awRR (< 12 low, 12-20 normal, > 20 high)
    if (latestVital.awrr !== null) {
      if (latestVital.awrr < VITAL_RANGES.awRR.low || latestVital.awrr > VITAL_RANGES.awRR.high) {
        newAlerts.push({
          id: `awrr-${latestVital.created_at}`,
          type: latestVital.awrr < VITAL_RANGES.awRR.low ? 'low' : 'high',
          vital: 'awRR',
          value: latestVital.awrr,
          timestamp: latestVital.created_at,
          severity: latestVital.awrr < 8 || latestVital.awrr > 25 ? 'critical' : 'warning',
        });
      }
    }

    console.log('[VitalNotifications] Generated alerts:', newAlerts);

    // Update alerts, keeping only the latest for each vital type
    setAlerts((prevAlerts) => {
      const vitalTypes = new Set(newAlerts.map(a => a.vital));
      const filteredPrev = prevAlerts.filter(a => !vitalTypes.has(a.vital));
      const updatedAlerts = [...filteredPrev, ...newAlerts].filter(a => !dismissedAlerts.has(a.id));


      const newAlertIds = new Set(updatedAlerts.map(a => a.id));
      // Play audio if available when new alerts appear
      const hasNewAlerts = Array.from(newAlertIds).some(id => !previousAlertIdsRef.current.has(id));
      if (hasNewAlerts && updatedAlerts.length > 0 && alarmAudioRef.current) {
        alarmAudioRef.current.play().catch(() => { });
      }
      previousAlertIdsRef.current = newAlertIds;

      console.log('[VitalNotifications] Updated alerts:', updatedAlerts);
      return updatedAlerts;
    });
  }, [vitals, dismissedAlerts]);

  const dismissAlert = (id: string) => {
    setDismissedAlerts((prev) => new Set([...prev, id]));
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const activeAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

  if (activeAlerts.length === 0) {
    return null;
  }

  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;

  return (
    <Card className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-l-4 border-red-500 shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500 rounded-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Vital Sign Alerts
              <div className="flex gap-2">
                {criticalCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                    {criticalCount} Critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500 text-white">
                    {warningCount} Warning
                  </span>
                )}
              </div>
            </h2>
            {patient && (
              <p className="text-sm text-muted-foreground">
                Patient: {patient.patient_name} (ID: {patient.patient_id})
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`relative p-3 rounded-lg border-2 transition-all hover:shadow-md ${alert.severity === 'critical'
              ? 'bg-red-100 dark:bg-red-950/30 border-red-500'
              : 'bg-orange-100 dark:bg-orange-950/30 border-orange-500'
              }`}
          >
            <button
              onClick={() => dismissAlert(alert.id)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-2 pr-6">
              <div className="mt-0.5">
                {alert.severity === 'critical' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-foreground truncate">
                    {alert.vital}
                  </h3>
                  <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${alert.type === 'high'
                    ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                    {alert.type === 'high' ? '↑ HIGH' : '↓ LOW'}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  {alert.type === 'high' ? (
                    <TrendingUp className="w-4 h-4 text-red-600 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                  <span className="text-lg font-bold text-foreground">
                    {alert.value}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleDateString()} • {new Date(alert.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default VitalNotifications;

