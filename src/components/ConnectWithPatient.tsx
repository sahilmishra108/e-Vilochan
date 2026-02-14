import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Video, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallOption {
    name: string;
    description: string;
    url: string;
}

const videoCallOptions: VideoCallOption[] = [
    {
        name: 'Google Meet',
        description: 'Secure video meetings',
        url: 'https://meet.google.com/new',
    },
    {
        name: 'Zoom',
        description: 'HD video conferencing',
        url: 'https://zoom.us/start/videomeeting',
    },
    {
        name: 'Microsoft Teams',
        description: 'Enterprise collaboration',
        url: 'https://teams.microsoft.com/l/meeting/new',
    },
    {
        name: 'Cisco Webex',
        description: 'Professional meetings',
        url: 'https://www.webex.com/startmeeting.html',
    },
    {
        name: 'Skype',
        description: 'Free video calls',
        url: 'https://www.skype.com/en/free-conference-call/',
    },
];

interface ConnectWithPatientProps {
    patientName?: string;
    isCollapsed?: boolean;
    variant?: 'sidebar' | 'grid';
}

const ConnectWithPatient = ({ patientName, isCollapsed, variant = 'sidebar' }: ConnectWithPatientProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleOpenLink = (platform: string, link: string) => {
        window.open(link, '_blank', 'noopener,noreferrer');
        toast({
            title: `Opening ${platform}`,
            description: 'Your meeting room is being prepared...',
            duration: 2000,
        });
        setIsOpen(false);
    };

    const buttonClass = variant === 'sidebar'
        ? `w-full bg-slate-900/50 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 transition-all duration-300 font-black rounded-2xl gap-3 border border-white/5 active:scale-95 group relative ${isCollapsed ? 'p-0 h-10 w-10 mx-auto justify-center' : 'px-6 h-14'}`
        : "w-full flex items-center justify-center gap-4 bg-white/40 backdrop-blur-xl border border-white/20 hover:bg-white/60 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-0.5 transition-all duration-500 shadow-sm rounded-2xl h-14 px-6 text-slate-700 active:scale-[0.98] group";

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    size={variant === 'sidebar' ? "lg" : "default"}
                    className={buttonClass}
                    title={isCollapsed ? "Connect with Patient" : ""}
                >
                    <div className={variant === 'sidebar'
                        ? `p-2 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors shrink-0 ${isCollapsed ? 'p-1.5' : ''}`
                        : "p-2.5 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-all duration-500"
                    }>
                        <Video className={variant === 'sidebar' ? (isCollapsed ? 'w-4 h-4' : 'w-4 h-4') : "w-4 h-4 text-blue-600"} />
                    </div>
                    {(!isCollapsed || variant === 'grid') && (
                        <span className={variant === 'sidebar'
                            ? "text-sm tracking-tight text-white/90 whitespace-nowrap"
                            : "text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-slate-900 transition-colors whitespace-nowrap"
                        }>
                            Connect with Patient
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-2" align="end">
                <DropdownMenuLabel className="px-3 py-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                            <Video className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm">Start Video Consultation</div>
                            <div className="text-xs text-muted-foreground font-normal">
                                Select a platform to start
                            </div>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <div className="space-y-1 p-1">
                    {videoCallOptions.map((option) => (
                        <DropdownMenuItem
                            key={option.name}
                            className="flex items-center justify-between p-3 cursor-pointer rounded-md focus:bg-slate-100 dark:focus:bg-slate-800 transition-colors group"
                            onClick={() => handleOpenLink(option.name, option.url)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-950 transition-colors border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-700">
                                    <Video className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100" />
                                </div>
                                <div>
                                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                        {option.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {option.description}
                                    </div>
                                </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                        </DropdownMenuItem>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default ConnectWithPatient;
