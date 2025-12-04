import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Camera, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    getPatientNotifications,
    subscribeToNotifications,
    clearPatientNotifications,
    VitalAlert
} from './PatientVitalMonitor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NotificationBellProps {
    patientId?: string | null;
}

const NotificationBell = ({ patientId }: NotificationBellProps) => {
    const [notifications, setNotifications] = useState<VitalAlert[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const updateNotifications = () => {
            if (!patientId) {
                setNotifications([]);
                return;
            }

            const pid = parseInt(patientId);
            if (!isNaN(pid)) {
                setNotifications(getPatientNotifications(pid));
            } else {
                setNotifications([]);
            }
        };

        // Initial load
        updateNotifications();

        // Subscribe to updates
        const unsubscribe = subscribeToNotifications(updateNotifications);

        return () => { unsubscribe(); };
    }, [patientId]);

    // Only render the bell if a patientId is provided
    if (!patientId) return null;

    const handleClear = () => {
        if (patientId) {
            const pid = parseInt(patientId);
            if (!isNaN(pid)) {
                clearPatientNotifications(pid);
            }
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative rounded-full w-10 h-10 bg-white/50 backdrop-blur-sm border-slate-200 hover:bg-white hover:border-primary/50 transition-all duration-300 hover:scale-110 shadow-sm hover:shadow-md">
                    <Bell className="h-5 w-5 text-slate-600 transition-transform duration-300 hover:rotate-12" />
                    {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md animate-pulse">
                            {notifications.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 rounded-3xl shadow-2xl border-white/30 bg-white/95 backdrop-blur-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200" align="end">
                {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-2 h-2 rounded-full bg-primary/20 animate-float" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
                    <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-secondary/20 animate-float" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
                    <div className="absolute bottom-1/3 left-1/3 w-1 h-1 rounded-full bg-primary/30 animate-float" style={{ animationDelay: '2s', animationDuration: '3.5s' }}></div>
                </div>

                <div className="relative">
                    {/* Header with gradient background and animated border */}
                    <div className="relative p-5 border-b border-slate-200/50 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
                        {/* Animated gradient line */}
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 animate-pulse"></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 animate-in slide-in-from-left-3 duration-300">
                                <div className="relative p-2 rounded-xl bg-primary/10 transition-all duration-300 hover:bg-primary/20 hover:scale-110 group">
                                    {/* Pulsing ring effect */}
                                    <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping opacity-0 group-hover:opacity-75"></div>
                                    <Bell className="h-5 w-5 text-primary transition-transform duration-300 hover:rotate-12 relative z-10" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">Vital Sign Alerts</h4>
                                    <p className="text-xs text-slate-500 mt-0.5 animate-pulse">Patient: Emily Davis (ID: 4)</p>
                                </div>
                            </div>
                            {patientId && notifications.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-105 animate-in fade-in-0 slide-in-from-right-2 duration-300 delay-100 relative overflow-hidden group"
                                    onClick={handleClear}
                                >
                                    <span className="relative z-10">Clear all</span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                </Button>
                            )}
                        </div>
                        {notifications.length > 0 && (
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-150 transition-all hover:bg-orange-100 hover:border-orange-200 hover:scale-105 relative overflow-hidden group">
                                {/* Animated background glow */}
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-200/0 via-orange-200/50 to-orange-200/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <span className="relative flex h-2 w-2 z-10">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 shadow-lg shadow-orange-500/50"></span>
                                </span>
                                <span className="text-xs font-bold text-orange-700 relative z-10">{notifications.length} Warning{notifications.length > 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>
                </div>

                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in-0 zoom-in-95 duration-500">
                            <div className="relative mb-4 animate-in zoom-in-0 duration-700 delay-100">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-xl animate-pulse"></div>
                                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-md">
                                    <Bell className="w-7 h-7 text-slate-400 transition-transform duration-300 hover:rotate-12" />
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-900 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-200">No new notifications</p>
                            <p className="text-xs text-slate-500 mt-2 max-w-[200px] animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-300">All vitals are within normal range. You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {notifications.map((alert, index) => (
                                <div
                                    key={alert.id}
                                    className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer animate-in fade-in-0 slide-in-from-right-3 ${alert.severity === 'critical'
                                            ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200 hover:border-red-300 hover:shadow-red-200/50'
                                            : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:border-blue-300 hover:shadow-blue-200/50'
                                        }`}
                                    style={{
                                        animationDelay: `${index * 100}ms`,
                                        animationDuration: '400ms'
                                    }}
                                >
                                    {/* Pulsing border effect */}
                                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${alert.severity === 'critical' ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                                        } animate-pulse`}></div>

                                    {/* Decorative gradient overlay */}
                                    <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-bl-full -mr-10 -mt-10 transition-all duration-500 group-hover:scale-150 group-hover:opacity-20 ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                                        }`}></div>

                                    {/* Shimmer effect on hover */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                    </div>

                                    {/* Animated corner accent */}
                                    <div className={`absolute top-0 left-0 w-0 h-0 border-t-[20px] border-l-[20px] rounded-tl-2xl transition-all duration-300 group-hover:border-t-[30px] group-hover:border-l-[30px] ${alert.severity === 'critical'
                                            ? 'border-t-red-400/20 border-l-transparent'
                                            : 'border-t-blue-400/20 border-l-transparent'
                                        }`}></div>

                                    <div className="relative p-4">
                                        <div className="flex items-start gap-3">
                                            {/* Icon with pulse ring */}
                                            <div className="relative">
                                                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${alert.severity === 'critical' ? 'bg-red-400/30 animate-ping' : 'bg-blue-400/30 animate-ping'
                                                    }`}></div>
                                                <div className={`flex-shrink-0 p-2.5 rounded-xl shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 relative ${alert.severity === 'critical'
                                                        ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-600 group-hover:shadow-red-300 group-hover:shadow-lg'
                                                        : 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 group-hover:shadow-blue-300 group-hover:shadow-lg'
                                                    }`}>
                                                    <AlertTriangle className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-800 transition-colors duration-200 group-hover:text-slate-900">{alert.vital}</span>
                                                        {/* Source indicator */}
                                                        {alert.source && (
                                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-200 ${alert.source === 'camera'
                                                                    ? 'bg-purple-100 text-purple-700 group-hover:bg-purple-200'
                                                                    : 'bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200'
                                                                }`}>
                                                                {alert.source === 'camera' ? (
                                                                    <Camera className="w-3 h-3" />
                                                                ) : (
                                                                    <Video className="w-3 h-3" />
                                                                )}
                                                                <span className="uppercase">{alert.source}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        {/* Badge glow effect */}
                                                        <div className={`absolute inset-0 rounded-full blur-sm opacity-0 group-hover:opacity-50 transition-opacity duration-300 ${alert.type === 'high' ? 'bg-red-500' : 'bg-blue-500'
                                                            }`}></div>
                                                        <span className={`relative text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${alert.type === 'high'
                                                                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white group-hover:from-red-600 group-hover:to-orange-600'
                                                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white group-hover:from-blue-600 group-hover:to-cyan-600'
                                                            }`}>
                                                            {alert.type}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-baseline justify-between gap-2">
                                                    <div className="flex items-baseline gap-1 relative">
                                                        {/* Value glow effect */}
                                                        <div className={`absolute inset-0 blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300 ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                                                            }`}></div>
                                                        <span className={`relative text-2xl font-extrabold transition-all duration-300 group-hover:scale-110 ${alert.severity === 'critical' ? 'text-red-600 group-hover:text-red-700' : 'text-blue-600 group-hover:text-blue-700'
                                                            }`}>
                                                            {alert.value}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-medium transition-colors duration-200 group-hover:text-slate-600">
                                                        {new Date(alert.timestamp).toLocaleString([], {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export default NotificationBell;
