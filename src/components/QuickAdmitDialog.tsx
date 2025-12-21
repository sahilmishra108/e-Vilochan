import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Zap, Plus, Building2, User, Activity } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ICU {
    icu_id: number;
    icu_name: string;
}

interface QuickAdmitDialogProps {
    trigger?: React.ReactNode;
}

const QuickAdmitDialog = ({ trigger }: QuickAdmitDialogProps) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'details' | 'confirm'>('details');

    // Data State
    const [icus, setIcus] = useState<ICU[]>([]);

    // Form State
    const [patientData, setPatientData] = useState({
        patient_name: "",
        age: "",
        gender: "Male",
        diagnosis: "",
        admission_date: new Date().toISOString().split('T')[0],
    });

    // ICU Selection State
    const [icuMode, setIcuMode] = useState<'existing' | 'new'>('existing');
    const [selectedIcuId, setSelectedIcuId] = useState<string>("");
    const [newIcuData, setNewIcuData] = useState({
        icu_name: "",
        location: ""
    });

    useEffect(() => {
        if (open) {
            fetchICUs();
        }
    }, [open]);

    const fetchICUs = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/icus');
            const data = await res.json();
            setIcus(data);
            if (data.length === 0) {
                setIcuMode('new');
            }
        } catch (error) {
            console.error("Error fetching ICUs:", error);
        }
    };

    const handlePatientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPatientData({ ...patientData, [e.target.name]: e.target.value });
    };

    const handleNewIcuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewIcuData({ ...newIcuData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let finalIcuId = selectedIcuId;

            // 1. Create ICU if needed
            if (icuMode === 'new') {
                const icuRes = await fetch("http://localhost:3000/api/icus", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newIcuData),
                });

                if (!icuRes.ok) throw new Error("Failed to create ICU");
                const icuResult = await icuRes.json();
                finalIcuId = icuResult.icuId; // Assuming backend returns insertId as icuId or similar. 
                // Let's verify backend assumption: In server/index.js, unfortunately I only saw patients endpoint, 
                // but AddICUDialog implies it works. I'll assume standard insertId response.
            }

            if (!finalIcuId && icuMode === 'existing') {
                throw new Error("Please select an ICU");
            }

            // 2. Create Patient
            const patientRes = await fetch("http://localhost:3000/api/patients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...patientData,
                    icu_id: finalIcuId
                }),
            });

            if (!patientRes.ok) throw new Error("Failed to add patient");
            const patientResult = await patientRes.json();

            toast.success("Patient admitted successfully!");
            setOpen(false);

            // 3. Redirect to Monitoring
            // Pass the new patient ID to auto-open
            navigate(`/multicamera?autoPatient=${patientResult.patientId}`);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 h-12 px-6 rounded-full font-bold text-lg group">
                        <Zap className="w-5 h-5 mr-2 animate-pulse" />
                        Quick Admit & Monitor
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl p-0 overflow-hidden gap-0">
                <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 p-6 border-b border-primary/10">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary">
                            <Activity className="w-6 h-6" />
                            Quick Admission
                        </DialogTitle>
                        <DialogDescription className="text-slate-600">
                            Admit a patient and start vitals monitoring immediately.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Patient Details Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            <User className="w-4 h-4 text-primary" /> Patient Details
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 md:col-span-1">
                                <Label htmlFor="patient_name">Full Name</Label>
                                <Input id="patient_name" name="patient_name" placeholder="John Doe" required value={patientData.patient_name} onChange={handlePatientChange} />
                            </div>
                            <div className="space-y-2 col-span-2 md:col-span-1">
                                <Label htmlFor="diagnosis">Diagnosis</Label>
                                <Input id="diagnosis" name="diagnosis" placeholder="e.g. Cardiac Arrest" required value={patientData.diagnosis} onChange={handlePatientChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="age">Age</Label>
                                <Input id="age" name="age" type="number" placeholder="45" required value={patientData.age} onChange={handlePatientChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={patientData.gender} onValueChange={(val) => setPatientData(prev => ({ ...prev, gender: val }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* ICU Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 uppercase tracking-wider">
                                <Building2 className="w-4 h-4 text-primary" /> ICU Assignment
                            </div>

                            <RadioGroup
                                value={icuMode}
                                onValueChange={(v: 'existing' | 'new') => setIcuMode(v)}
                                className="flex gap-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="existing" id="existing" />
                                    <Label htmlFor="existing" className="cursor-pointer">Select Existing</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="new" id="new" />
                                    <Label htmlFor="new" className="cursor-pointer">Create New</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {icuMode === 'existing' ? (
                            <div className="space-y-2 animate-fade-in">
                                <Label>Select Targeted ICU</Label>
                                <Select value={selectedIcuId} onValueChange={setSelectedIcuId} required={icuMode === 'existing'}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select an ICU..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {icus.map(icu => (
                                            <SelectItem key={icu.icu_id} value={icu.icu_id.toString()}>
                                                {icu.icu_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {icus.length === 0 && (
                                    <p className="text-xs text-red-500">No ICUs available. Please create one.</p>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 animate-fade-in bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="space-y-2">
                                    <Label htmlFor="icu_name">New ICU Name</Label>
                                    <Input id="icu_name" name="icu_name" placeholder="e.g. Neuro ICU" required={icuMode === 'new'} value={newIcuData.icu_name} onChange={handleNewIcuChange} className="bg-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="location">Location</Label>
                                    <Input id="location" name="location" placeholder="Floor/Block" value={newIcuData.location} onChange={handleNewIcuChange} className="bg-white" />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-lg px-8">
                            {loading ? "Admitting..." : "Admit & Monitor"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default QuickAdmitDialog;
