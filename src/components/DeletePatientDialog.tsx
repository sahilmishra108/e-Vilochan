import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeletePatientDialogProps {
    patientId: number;
    patientName: string;
    onPatientDeleted: () => void;
}

const DeletePatientDialog = ({ patientId, patientName, onPatientDeleted }: DeletePatientDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);

        try {
            const response = await fetch(`http://localhost:3000/api/patients/${patientId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                const data = await response.json();
                toast.success('Patient Discharged', {
                    description: data.message,
                });
                setOpen(false);
                onPatientDeleted();
            } else {
                const error = await response.json();
                toast.error('Failed to discharge patient', {
                    description: error.message || 'Please try again.',
                });
            }
        } catch (error) {
            console.error('Error deleting patient:', error);
            toast.error('Failed to delete patient', {
                description: 'Network error. Please check your connection.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                >
                    Discharge Patient
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-bold text-red-600">
                        Discharge Patient?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3 pt-2">
                        <p className="text-base">
                            You are about to discharge and remove record for:
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="font-bold text-lg text-red-900">{patientName}</p>
                            <p className="text-sm text-red-700">Patient ID: #{patientId}</p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-2">
                            <p className="font-semibold text-yellow-900">This action will delete:</p>
                            <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                                <li>Patient demographic information</li>
                                <li>All vital signs records</li>
                                <li>Bed assignment</li>
                                <li>Complete medical history</li>
                            </ul>
                        </div>
                        <p className="text-base font-bold text-red-600">
                            This action cannot be undone!
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                    >
                        {loading ? 'Discharging...' : 'Yes, Discharge'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default DeletePatientDialog;
