
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { API_BASE_URL } from '@/config';

interface AddPatientDialogProps {
    onPatientAdded: () => void;
    icuId?: number;
}

const AddPatientDialog = ({ onPatientAdded, icuId }: AddPatientDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { authFetch } = useAuth();
    const [consentGiven, setConsentGiven] = useState(false);
    const [formData, setFormData] = useState({
        patient_name: '',
        age: '',
        gender: '',
        diagnosis: '',
        admission_date: new Date().toISOString().split('T')[0],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Ensure ICU ID is available
        if (!icuId) {
            toast.error("ICU context is missing. Please select an ICU first.");
            setLoading(false);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE_URL}/api/patients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    age: parseInt(formData.age),
                    icu_id: icuId
                }),
            });

            if (response.ok) {
                toast.success('Patient added successfully!', {
                    description: `${formData.patient_name} has been added to the system.`,
                });
                setOpen(false);
                setFormData({
                    patient_name: '',
                    age: '',
                    gender: '',
                    diagnosis: '',
                    admission_date: new Date().toISOString().split('T')[0],
                });
                onPatientAdded();
            } else {
                const error = await response.json();
                toast.error('Failed to add patient', {
                    description: error.message || 'Please try again.',
                });
            }
        } catch (error) {
            console.error('Error adding patient:', error);
            toast.error('Failed to add patient', {
                description: 'Network error. Please check your connection.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-md">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add New Patient
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Add New Patient</DialogTitle>
                        <DialogDescription>
                            Enter patient details to create a new record in the current ICU.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="overflow-y-auto px-6 py-2 flex-1">
                    <form id="add-patient-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="patient_name" className="font-semibold">
                                    Patient Name *
                                </Label>
                                <Input
                                    id="patient_name"
                                    placeholder="John Doe"
                                    value={formData.patient_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, patient_name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="age" className="font-semibold">
                                        Age *
                                    </Label>
                                    <Input
                                        id="age"
                                        type="number"
                                        placeholder="45"
                                        min="0"
                                        max="150"
                                        value={formData.age}
                                        onChange={(e) =>
                                            setFormData({ ...formData, age: e.target.value })
                                        }
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="gender" className="font-semibold">
                                        Gender *
                                    </Label>
                                    <select
                                        id="gender"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        value={formData.gender}
                                        onChange={(e) =>
                                            setFormData({ ...formData, gender: e.target.value })
                                        }
                                        required
                                    >
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="diagnosis" className="font-semibold">
                                    Diagnosis *
                                </Label>
                                <Input
                                    id="diagnosis"
                                    placeholder="Hypertension"
                                    value={formData.diagnosis}
                                    onChange={(e) =>
                                        setFormData({ ...formData, diagnosis: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admission_date" className="font-semibold">
                                    Admission Date *
                                </Label>
                                <Input
                                    id="admission_date"
                                    type="date"
                                    value={formData.admission_date}
                                    onChange={(e) =>
                                        setFormData({ ...formData, admission_date: e.target.value })
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors duration-300 ${formData.age && parseInt(formData.age) < 18 ? 'bg-amber-50/50 border-amber-200' : 'bg-blue-50/50 border-blue-100'}`}>
                                <Checkbox
                                    id="consent-add"
                                    checked={consentGiven}
                                    onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="consent-add"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700"
                                    >
                                        {formData.age && parseInt(formData.age) < 18
                                            ? "I confirm that Parental/Guardian consent has been obtained."
                                            : "I confirm that explicit consent has been obtained."}
                                    </Label>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {formData.age && parseInt(formData.age) < 18
                                            ? "Since the patient is a minor (<18), I certify that a legal guardian has consented to data collection in compliance with DPDP & GDPR."
                                            : "I certify that the patient has consented to data collection and monitoring in compliance with DPDP & GDPR regulations."}
                                    </p>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 pt-4 border-t border-border/40 bg-gray-50/50">
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="add-patient-form"
                            className="bg-[#0066CC] hover:bg-[#0052A3]"
                            disabled={loading || !consentGiven}
                        >
                            {loading ? 'Adding...' : 'Add Patient'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AddPatientDialog;
