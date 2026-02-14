
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Camera, Plus, X, Monitor, ChevronRight, Activity } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import CameraFeed from "@/components/CameraFeed";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from '@/config';

interface ICU {
    icu_id: number;
    icu_name: string;
}

interface Patient {
    patient_id: number;
    patient_name: string;
    icu_id: number | null;
}

interface MonitorSlot {
    id: number;
    icuId: string | null;
    patientId: string | null;
    status: 'active';
}

const MultiCameraView = () => {
    const navigate = useNavigate();
    const [monitors, setMonitors] = useState<MonitorSlot[]>([]);
    const [icus, setIcus] = useState<ICU[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const { authFetch } = useAuth();

    // Dialog State
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [selectedPatients, setSelectedPatients] = useState<string[]>([]);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [icusRes, patientsRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/api/icus`),
                    authFetch(`${API_BASE_URL}/api/patients`)
                ]);

                const icusData = await icusRes.json();
                const patientsData = await patientsRes.json();

                setIcus(icusData);
                setPatients(patientsData);

                // Auto-add patient if URL param exists
                const searchParams = new URLSearchParams(window.location.search);
                const autoPatientId = searchParams.get('autoPatient');

                if (autoPatientId && patientsData.length > 0) {
                    const patient = patientsData.find((p: any) => p.patient_id.toString() === autoPatientId);
                    if (patient) {
                        setMonitors(prev => {
                            if (prev.some(m => m.patientId === autoPatientId)) return prev;
                            return [...prev, {
                                id: Date.now(),
                                icuId: patient.icu_id?.toString() || null,
                                patientId: autoPatientId,
                                status: 'active'
                            }];
                        });
                        window.history.replaceState({}, '', '/multicamera');
                    }
                }

                setLoading(false);
            } catch (error) {
                console.error("Error fetching data:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const removeMonitor = (id: number) => {
        setMonitors(prev => prev.filter(m => m.id !== id));
    };

    const handlePatientToggle = (patientId: string) => {
        setSelectedPatients(prev =>
            prev.includes(patientId)
                ? prev.filter(id => id !== patientId)
                : [...prev, patientId]
        );
    };

    const handleAddSelectedMonitors = () => {
        const newMonitors: MonitorSlot[] = selectedPatients.map(patientId => {
            const patient = patients.find(p => p.patient_id.toString() === patientId);
            return {
                id: Date.now() + Math.random(), // Ensure unique ID
                icuId: patient?.icu_id?.toString() || null,
                patientId: patientId,
                status: 'active'
            };
        });

        // Filter out patients that are already monitored to avoid duplicates
        const uniqueNewMonitors = newMonitors.filter(nm =>
            !monitors.some(m => m.patientId === nm.patientId)
        );

        setMonitors(prev => [...prev, ...uniqueNewMonitors]);
        setIsSelectionOpen(false);
        setSelectedPatients([]);
    };

    // Filter patients who are not yet monitored for the list
    const availablePatients = patients.filter(p => !monitors.some(m => m.patientId === p.patient_id.toString()));

    const handleSelectAll = () => {
        if (selectedPatients.length === availablePatients.length) {
            setSelectedPatients([]);
        } else {
            setSelectedPatients(availablePatients.map(p => p.patient_id.toString()));
        }
    }

    return (
        <div className="min-h-screen bg-background overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] animate-grid-flow"></div>
                <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
            </div>

            {/* Header */}
            <header className="relative z-30 bg-white/40 backdrop-blur-xl border-b border-white/20 shadow-sm px-8 py-4">
                <div className="max-w-[1800px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        <img
                            src="/eye logo.png"
                            alt="e-Vilochan Logo"
                            className="w-10 h-auto hover:scale-110 transition-transform duration-500"
                        />
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight"><span className="text-[0.8em]">e</span>-Vilochan</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Live Monitoring</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => setIsSelectionOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all rounded-xl px-6"
                        >
                            Configure Monitors
                        </Button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <Link to="/">
                            <Button variant="ghost" size="sm" className="hover:bg-primary/10 text-slate-600 transition-all rounded-xl">
                                <Home className="w-4 h-4 mr-2" />
                                Exit to Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="relative z-10 p-6 min-h-[calc(100vh-88px)] overflow-y-auto">
                {monitors.length === 0 ? (
                    <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-fade-in-up">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <Monitor className="w-12 h-12 text-primary/60" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-700">No Active Monitors</h2>
                        <p className="text-slate-500 max-w-md">
                            Select patients from the list to start real-time Tele-ICU vitals tracking.
                        </p>
                        <Button onClick={() => setIsSelectionOpen(true)} size="lg" className="bg-primary hover:bg-primary/90 shadow-xl hover:shadow-primary/25 transition-all hover:scale-105">
                            Show Monitors
                        </Button>
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 ${monitors.length > 1 ? 'lg:grid-cols-2' : ''} xl:grid-cols-2 2xl:grid-cols-3 gap-8 animate-fade-in-up`}>
                        {monitors.map((monitor, index) => (
                            <div key={monitor.id} className="relative group animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                                <div className="glass-card glass-border rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 hover:-translate-y-2">
                                    <div className="bg-slate-900/40 px-6 py-4 border-b border-white/10 flex justify-between items-center relative z-20">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-emerald-500/30"></div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 text-sm tracking-tight leading-none mb-1">
                                                    {patients.find(p => p.patient_id.toString() === monitor.patientId)?.patient_name}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.1em]">
                                                    {icus.find(i => i.icu_id.toString() === monitor.icuId)?.icu_name} • Bed: {monitor.patientId}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link to={`/dashboard?patientId=${monitor.patientId}&tab=dashboard`} target="_blank">
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 text-primary">
                                                    <Activity className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 text-rose-500"
                                                onClick={() => removeMonitor(monitor.id)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-2 bg-slate-950">
                                        <div className="relative rounded-2xl overflow-hidden border border-white/5">
                                            <CameraFeed patientId={monitor.patientId} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Monitor Selection Dialog */}
            <Dialog open={isSelectionOpen} onOpenChange={setIsSelectionOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-slate-800">Select Patients to Monitor</DialogTitle>
                        <DialogDescription>
                            Choose one or more patients from the list below to add to your monitoring view.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[300px] overflow-y-auto space-y-2 py-4 pr-2">
                        {availablePatients.length > 0 && (
                            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/20 hover:bg-secondary/30 transition-coors mb-2">
                                <Checkbox
                                    id="select-all-patients"
                                    checked={selectedPatients.length === availablePatients.length}
                                    onCheckedChange={handleSelectAll}
                                />
                                <Label
                                    htmlFor="select-all-patients"
                                    className="text-sm font-medium leading-none cursor-pointer block"
                                >
                                    Select All Patients
                                </Label>
                            </div>
                        )}
                        {availablePatients.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No patients available to add.</p>
                                <p className="text-xs mt-1">All patients are currently being monitored or none exist.</p>
                            </div>
                        ) : (
                            availablePatients.map(patient => (
                                <div key={patient.patient_id} className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                    <Checkbox
                                        id={`patient-${patient.patient_id}`}
                                        checked={selectedPatients.includes(patient.patient_id.toString())}
                                        onCheckedChange={() => handlePatientToggle(patient.patient_id.toString())}
                                    />
                                    <div className="flex-1">
                                        <Label
                                            htmlFor={`patient-${patient.patient_id}`}
                                            className="text-sm font-medium leading-none cursor-pointer block"
                                        >
                                            {patient.patient_name}
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                (ID: {patient.patient_id})
                                            </span>
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {icus.find(i => i.icu_id === patient.icu_id)?.icu_name || 'No ICU Assigned'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSelectionOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddSelectedMonitors}
                            disabled={selectedPatients.length === 0}
                            className="bg-primary hover:bg-primary/90"
                        >
                            Start Monitoring ({selectedPatients.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MultiCameraView;

