import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/config';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                toast({
                    title: "Request Sent",
                    description: data.message,
                });
                // Optional: redirect to login or show success state
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: data.error || "Something went wrong",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not connect to the server",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 p-4 relative overflow-hidden">
            {/* Grid Background Pattern */}
            <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, rgb(148 163 184 / 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgb(148 163 184 / 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -ml-48 -mb-48" />

            <Card className="w-full max-w-md relative bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-2xl shadow-slate-200/50">
                <CardHeader className="space-y-3 pb-6">
                    <div className="flex items-center justify-center mb-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-primary/20 rounded-2xl blur-xl" />
                            <div className="relative bg-gradient-to-br from-emerald-50 to-primary/10 p-4 rounded-2xl border border-emerald-200/50 shadow-lg">
                                <img src="/eye logo.png" alt="e-Vilochan" className="w-10 h-10" />
                            </div>
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-sm font-bold text-blue-600 tracking-[0.3em]">e-Vilochan</h2>
                        <CardTitle className="text-3xl font-black tracking-tight text-slate-900">
                            Forgot Password
                        </CardTitle>
                    </div>
                    <CardDescription className="text-center text-slate-600 font-medium">
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                            <Input
                                type="email"
                                placeholder="doctor@hospital.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm"
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-5 pt-2">
                        <Button
                            type="submit"
                            className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-95"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                    Sending...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Send Reset Link
                                </span>
                            )}
                        </Button>
                        <Link
                            to="/login"
                            className="text-sm text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors flex items-center gap-2 justify-center"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Login
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default ForgotPassword;
