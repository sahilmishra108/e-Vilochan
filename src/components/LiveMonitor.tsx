import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, Heart, Droplet, Wind, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LiveMonitorProps {
    patientId: number;
}

interface VitalData {
    hr: number | null;
    pulse: number | null;
    spo2: number | null;
    etco2: number | null;
    awrr: number | null;
    created_at: string;
}

const VITAL_RANGES = {
    hr: { low: 60, high: 100, critical_low: 40, critical_high: 120 },
    spo2: { low: 95, critical_low: 90 },
    etco2: { low: 35, high: 45, critical_low: 30, critical_high: 50 },
    awrr: { low: 12, high: 20, critical_low: 8, critical_high: 25 }
};

const LiveMonitor = ({ patientId }: LiveMonitorProps) => {
    const [latestVitals, setLatestVitals] = useState<VitalData | null>(null);
    const [isMonitoring, setIsMonitoring] = useState(false);

    useEffect(() => {
        // Fetch latest vitals
        const fetchLatestVitals = async () => {
            try {
                const res = await fetch(`http://localhost:3000/api/vitals/${patientId}?limit=1`);
                const data = await res.json();
                if (data.length > 0) {
                    setLatestVitals(data[0]);
                    setIsMonitoring(true);
                }
            } catch (error) {
                console.error('Error fetching vitals:', error);
            }
        };

        fetchLatestVitals();

        // Setup Socket.IO for real-time updates
        const socket = io('http://localhost:3000');
        socket.emit('join-patient', patientId);

        socket.on('vital-update', (data: any) => {
            if (data.patient_id === patientId) {
                setLatestVitals(data);
                setIsMonitoring(true);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [patientId]);

    const getVitalStatus = (value: number | null, type: 'hr' | 'spo2' | 'etco2' | 'awrr'): 'normal' | 'warning' | 'critical' => {
        if (value === null) return 'normal';

        const ranges = VITAL_RANGES[type];

        if (type === 'hr' || type === 'etco2' || type === 'awrr') {
            const r = ranges as { low: number; high: number; critical_low: number; critical_high: number };
            if (value < r.critical_low || value > r.critical_high) return 'critical';
            if (value < r.low || value > r.high) return 'warning';
        } else if (type === 'spo2') {
            const r = ranges as { low: number; critical_low: number };
            if (value < r.critical_low) return 'critical';
            if (value < r.low) return 'warning';
        }

        return 'normal';
    };

    const getStatusColor = (status: 'normal' | 'warning' | 'critical') => {
        switch (status) {
            case 'critical':
                return 'bg-red-500 text-white';
            case 'warning':
                return 'bg-yellow-500 text-white';
            default:
                return 'bg-green-500 text-white';
        }
    };

    const getTrendIcon = (value: number | null, type: 'hr' | 'spo2' | 'etco2' | 'awrr') => {
        const status = getVitalStatus(value, type);
        if (status === 'critical') return <TrendingUp className="w-3 h-3" />;
        if (status === 'warning') return <TrendingDown className="w-3 h-3" />;
        return <Minus className="w-3 h-3" />;
    };

    if (!isMonitoring || !latestVitals) {
        return (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-center gap-2 text-slate-400">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm">No active monitoring</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-3">
            {/* Live Status Indicator */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Live Monitoring</span>
                </div>
                <span className="text-xs text-slate-500">
                    {new Date(latestVitals.created_at).toLocaleTimeString()}
                </span>
            </div>

            {/* Vital Signs KPI Grid */}
            <div className="grid grid-cols-2 gap-2">
                {/* Heart Rate */}
                <div className={`p-3 rounded-lg ${getStatusColor(getVitalStatus(latestVitals.hr, 'hr'))} transition-all`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            <span className="text-xs font-semibold">HR</span>
                        </div>
                        {getTrendIcon(latestVitals.hr, 'hr')}
                    </div>
                    <div className="text-2xl font-bold">{latestVitals.hr ?? '-'}</div>
                    <div className="text-xs opacity-90">bpm</div>
                </div>

                {/* SpO2 */}
                <div className={`p-3 rounded-lg ${getStatusColor(getVitalStatus(latestVitals.spo2, 'spo2'))} transition-all`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                            <Droplet className="w-3 h-3" />
                            <span className="text-xs font-semibold">SpO2</span>
                        </div>
                        {getTrendIcon(latestVitals.spo2, 'spo2')}
                    </div>
                    <div className="text-2xl font-bold">{latestVitals.spo2 ?? '-'}</div>
                    <div className="text-xs opacity-90">%</div>
                </div>

                {/* EtCO2 */}
                <div className={`p-3 rounded-lg ${getStatusColor(getVitalStatus(latestVitals.etco2, 'etco2'))} transition-all`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                            <Wind className="w-3 h-3" />
                            <span className="text-xs font-semibold">EtCO2</span>
                        </div>
                        {getTrendIcon(latestVitals.etco2, 'etco2')}
                    </div>
                    <div className="text-2xl font-bold">{latestVitals.etco2 ?? '-'}</div>
                    <div className="text-xs opacity-90">mmHg</div>
                </div>

                {/* Respiratory Rate */}
                <div className={`p-3 rounded-lg ${getStatusColor(getVitalStatus(latestVitals.awrr, 'awrr'))} transition-all`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span className="text-xs font-semibold">RR</span>
                        </div>
                        {getTrendIcon(latestVitals.awrr, 'awrr')}
                    </div>
                    <div className="text-2xl font-bold">{latestVitals.awrr ?? '-'}</div>
                    <div className="text-xs opacity-90">/min</div>
                </div>
            </div>

            {/* Mini ECG Wave Simulation */}
            <div className="p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">ECG</span>
                    <span className="text-xs text-green-400">{latestVitals.hr ?? '--'} BPM</span>
                </div>
                <div className="h-12 flex items-center">
                    <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                        <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.5"
                            points="0,20 20,20 25,5 30,35 35,20 40,20 60,20 65,5 70,35 75,20 80,20 100,20 105,5 110,35 115,20 120,20 140,20 145,5 150,35 155,20 160,20 180,20 185,5 190,35 195,20 200,20"
                            className="animate-pulse"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default LiveMonitor;
