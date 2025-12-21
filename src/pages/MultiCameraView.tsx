import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
    const [monitors, setMonitors] = useState<MonitorSlot[]>([]);
    const [icus, setIcus] = useState<ICU[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog State
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [selectedPatients, setSelectedPatients] = useState<string[]>([]);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [icusRes, patientsRes] = await Promise.all([
                    fetch('http://localhost:3000/api/icus'),
                    fetch('http://localhost:3000/api/patients')
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

    return (
        <div className="min-h-screen bg-background overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] animate-grid-flow"></div>
                <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
            </div>

            {/* Header */}
            <div className="relative z-20 p-6 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link to="/" className="transition-transform hover:scale-105 block">
                        <img
                            src="/PATH_Logo_Color (1).png"
                            alt="PATH Logo"
                            className="h-10 w-auto drop-shadow-sm"
                        />
                    </Link>
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-primary" />
                        Multi-Patient Live Monitoring
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <Button onClick={() => setIsSelectionOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all">
                        Show Monitors
                    </Button>
                    <Link to="/">
                        <Button variant="outline" size="sm" className="bg-white/50 backdrop-blur-sm hover:bg-white transition-all">
                            <Home className="w-4 h-4 mr-2 text-primary" />
                            Home
                        </Button>
                    </Link>
                </div>
            </div>

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
                    <div className={`grid grid-cols-1 ${monitors.length > 1 ? 'lg:grid-cols-2' : ''} xl:grid-cols-2 2xl:grid-cols-3 gap-6 animate-fade-in-up`}>
                        {monitors.map((monitor, index) => (
                            <div key={monitor.id} className="relative group animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                                {/* Active Monitoring State */}
                                <div className="relative bg-background rounded-xl border shadow-lg overflow-hidden">
                                    <div className="absolute top-2 right-2 z-20 flex gap-2">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-8 px-2 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeMonitor(monitor.id)}
                                        >
                                            <X className="w-4 h-4 mr-1" /> Remove
                                        </Button>
                                    </div>
                                    <div className="p-1">
                                        <div className="bg-slate-900/5 px-4 py-2 border-b flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                <span className="font-semibold text-sm">
                                                    Patient: {patients.find(p => p.patient_id.toString() === monitor.patientId)?.patient_name}
                                                </span>
                                                <Link to={`/dashboard?patientId=${monitor.patientId}&tab=dashboard`} target="_blank">
                                                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] flex items-center gap-1 ml-2 bg-white/80 hover:bg-white text-primary border-primary/20">
                                                        <Activity className="w-3 h-3" /> View Data
                                                    </Button>
                                                </Link>
                                            </div>
                                            <span className="text-xs text-muted-foreground uppercase font-mono">
                                                {icus.find(i => i.icu_id.toString() === monitor.icuId)?.icu_name}
                                            </span>
                                        </div>
                                        <CameraFeed patientId={monitor.patientId} />
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
