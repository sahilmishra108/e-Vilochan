import { useState, useEffect, useRef } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { io } from "socket.io-client";
import { MessageSquare, Send, Image as ImageIcon, X, Loader2, Mic, StopCircle, Play, Pause, MoreVertical, Trash2, Check, CheckCheck, Camera, Smartphone, Download } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useToast } from "@/components/ui/use-toast";
import { API_BASE_URL } from '@/config';

interface Message {
    message_id: number;
    icu_id?: number;
    sender_id: number;
    content: string;
    message_type: 'text' | 'image' | 'audio';
    image_url: string | null;
    sender_name: string;
    sender_role: string;
    created_at: string;
}

interface ChatSheetProps {
    patientContext?: {
        id: number | string;
        name: string;
        age: number;
        diagnosis: string;
        icuId: number;
    };
    customButton?: React.ReactNode;
}

export const ChatView = ({ patientContext }: { patientContext?: ChatSheetProps['patientContext'] }) => {
    const { user, token } = useAuth();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recognitionRef = useRef<any>(null);

    // Camera State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        if (!user) return;

        // Connect to Socket.io
        socketRef.current = io(API_BASE_URL);

        if (patientContext?.id) {
            socketRef.current.emit('join-patient', patientContext.id);
        } else {
            const filterIcuId = user.icu_id;
            if (filterIcuId) {
                socketRef.current.emit('join-icu', filterIcuId);
            } else {
                socketRef.current.emit('join-hospital', user.hospital_id);
            }
        }

        socketRef.current.on('receive-message', (message: Message) => {
            setMessages((prev) => [...prev, message]);
        });

        fetchMessages();

        return () => {
            socketRef.current?.disconnect();
        };
    }, [user, patientContext?.icuId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const patientId = patientContext?.id;
            const icuId = patientContext?.icuId || user?.icu_id;

            let url = `${API_BASE_URL}/api/messages/${user?.hospital_id}`;
            const params = new URLSearchParams();

            if (patientId) params.append('patient_id', patientId.toString());
            else if (icuId) params.append('icu_id', icuId.toString());

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            }
        } catch (error) {
            console.error("Failed to fetch messages", error);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = async () => {
        if (!confirm("Are you sure you want to clear this chat? This cannot be undone.")) return;

        try {
            const url = `${API_BASE_URL}/api/messages/${user?.hospital_id}`;
            const params = new URLSearchParams();
            if (patientContext?.id) params.append('patient_id', patientContext.id.toString());
            else if (patientContext?.icuId) params.append('icu_id', patientContext.icuId.toString());
            else if (user?.icu_id) params.append('icu_id', user.icu_id.toString());

            // If we are in a patient context, we definitely want to delete by patient_id
            // But the current implementation of fetchMessages adds constraints.
            // We need to match those constraints for the DELETE request.

            const queryString = params.toString();
            const deleteUrl = `${url}?${queryString}`;

            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setMessages([]);
                toast({ title: "Chat Cleared", description: "Messages have been removed." });
            } else {
                toast({ variant: "destructive", title: "Error", description: "Failed to clear chat." });
            }
        } catch (error) {
            console.error("Failed to clear chat", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to clear chat." });
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!newMessage.trim() && !selectedImage && !audioBlob) || !user) return;

        let finalAudioUrl = null;
        if (audioBlob) {
            // Upload audio
            const reader = new FileReader();
            finalAudioUrl = await new Promise<string>((resolve) => {
                reader.onloadend = async () => {
                    const base64String = reader.result as string;
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/messages/upload`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ image: base64String })
                        });
                        if (response.ok) {
                            const data = await response.json();
                            resolve(data.url);
                        } else {
                            resolve(null as any);
                        }
                    } catch {
                        resolve(null as any);
                    }
                };
                reader.readAsDataURL(audioBlob);
            });
        }

        const messageData = {
            hospital_id: user.hospital_id,
            icu_id: patientContext?.icuId || user.icu_id,
            patient_id: patientContext?.id || null,
            sender_id: user.doctor_id,
            content: newMessage.trim(),
            message_type: finalAudioUrl ? 'audio' : (selectedImage ? 'image' : 'text'),
            image_url: finalAudioUrl || selectedImage,
        };

        socketRef.current.emit('send-message', messageData);
        setNewMessage("");
        setSelectedImage(null);
        setAudioBlob(null);
        setAudioUrl(null);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Audio Recording
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            const chunks: BlobPart[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();

            // Speech to Text
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                // @ts-ignore
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    let transcript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        transcript += event.results[i][0].transcript;
                    }
                    if (transcript) {
                        // Append to existing text if needed, or just set it? 
                        // To avoid overwriting manual typing, we might need a more complex merge, 
                        // but simple appending for now is safer.
                        setNewMessage((prev) => {
                            // Only append the new part? 
                            // Actually, continuous recognition returns the *session* results.
                            // Simplified: Just set the input to what we hear (+ prev if we want to be fancy, but let's reset for now or just append)
                            // Better: Current input + space + new transcript? 
                            // The 'interim' results fire constantly. Let's just use the final result or update live.
                            return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + transcript;
                        });
                        // NOTE: This basic implementation might duplicate text if "continuous" fires multiple finals. 
                        // For a robust implementation, we'd track the 'session start' text.
                        // Let's rely on the user stopping talking to finalize.
                        // ACTUALLY: `setNewMessage` inside `onresult` with `continuous=true` and `prev` is tricky.
                        // Let's use `onresult` to just SET the text if we assume the user is dictating the whole message.
                        // OR: We only add the *new* segment.
                    }
                };

                // Let's use a simpler non-continuous approach for stability if they pause?
                // No, continuous is better for long sentences.
                // We'll just handle it simply:
                // We won't merge automatically to avoid infinite loops/duplication.
                // We will store the "start text" in a ref?
            }

            // Simple STT for Demo: Single sentence
            if ('webkitSpeechRecognition' in window) {
                // @ts-ignore
                const recognition = new window.webkitSpeechRecognition();
                recognitionRef.current = recognition;
                recognition.continuous = true;
                recognition.interimResults = true;

                let finalString = newMessage; // Start with current text

                recognition.onresult = (event: any) => {
                    let validTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            validTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (validTranscript) {
                        setNewMessage(prev => prev + " " + validTranscript);
                    }
                };
                recognition.start();
            }

            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast({
                variant: 'destructive',
                title: "Microphone Error",
                description: "Could not access microphone."
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        processFile(file);
    };

    const processFile = (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            toast({ variant: "destructive", title: "File too large", description: "Max size is 5MB" });
            return;
        }
        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            uploadImage(base64String);
        };
        reader.readAsDataURL(file);
    };

    const uploadImage = async (base64String: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ image: base64String })
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedImage(data.url);
                setIsCameraOpen(false); // Close camera if open
                stopCamera();
            }
        } catch (error) {
            console.error("Upload failed", error);
            toast({ variant: "destructive", title: "Upload Failed" });
        } finally {
            setUploading(false);
        }
    };

    // Camera Functions
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setIsCameraOpen(true);
            // Wait for modal to open and ref to populate
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            }, 100);
        } catch (err) {
            console.error("Camera Error:", err);
            toast({ variant: "destructive", title: "Camera Error", description: "Could not access camera." });
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                // Set canvas dimensions to match video
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);

                const dataUrl = canvasRef.current.toDataURL('image/jpeg');
                uploadImage(dataUrl);
            }
        }
    };

    const downloadImage = (url: string, filename: string = 'image.jpg') => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col gap-1">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        ICU Collaboration Chat
                    </h2>
                    {patientContext && (
                        <div className="mt-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                    Patient: {patientContext.name}
                                </span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                    ID: #PAT-{patientContext.id.toString().padStart(4, '0')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-slate-500">
                                    Diagnosis: <span className="text-slate-900 font-black">{patientContext.diagnosis}</span>
                                </span>
                                <span className="font-bold text-slate-500">
                                    Age: <span className="text-slate-900 font-black">{patientContext.age} Yrs</span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200 text-slate-500">
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={clearChat} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear Chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ScrollArea className="flex-1 p-4 bg-[#efe7dd] relative" ref={scrollRef}>
                {/* WhatsApp Doodle Background Pattern Overlay */}
                <div className="absolute inset-0 opacity-[0.06] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] pointer-events-none bg-repeat"></div>

                {loading ? (
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="space-y-2 relative z-10 pb-4">
                        {messages.map((msg, idx) => {
                            const isMe = msg.sender_id === user?.doctor_id;
                            const showTail = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;

                            return (
                                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showTail ? 'mt-2' : 'mt-0.5'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                    {!isMe && showTail && (
                                        <span className="text-[10px] font-bold text-slate-500 ml-2 mb-0.5 px-1">
                                            {msg.sender_name}
                                        </span>
                                    )}

                                    <div className={`relative max-w-[75%] px-3 py-1.5 shadow-sm text-sm group
                                        ${isMe
                                            ? 'bg-[#d9fdd3] text-slate-900 rounded-2xl rounded-tr-none'
                                            : 'bg-white text-slate-900 rounded-2xl rounded-tl-none'
                                        }
                                    `}>
                                        {/* Tail Pseudo-element simulation (CSS borders are tricky in inline styles, keeping simple rounded corners for now which looks modern enough) */}

                                        {msg.message_type === 'image' && msg.image_url && (
                                            <div className="mb-1 mt-1 overflow-hidden rounded-lg group/img relative">
                                                <img src={msg.image_url} alt="Shared" className="max-w-full h-auto object-cover" />
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
                                                    onClick={() => downloadImage(msg.image_url!, `chat_image_${idx}.jpg`)}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                        {msg.message_type === 'audio' && msg.image_url && (
                                            <div className="mb-1 mt-1 flex items-center gap-2 pr-2">
                                                <audio controls src={msg.image_url} className="h-8 w-[200px]" />
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-end gap-x-2 relative z-10">
                                            {msg.content && <span className="leading-relaxed whitespace-pre-wrap">{msg.content}</span>}
                                            <span className="text-[9px] text-slate-500 min-w-[40px] text-right ml-auto flex items-center justify-end gap-0.5 mt-1 h-3 self-end">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                {isMe && <CheckCheck className="w-3 h-3 text-blue-500" />}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>

            <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 space-y-3 z-20">
                {selectedImage && (
                    <div className="relative inline-block">
                        <img src={selectedImage} alt="Preview" className="h-20 w-auto rounded-lg border-2 border-primary/20 shadow-md" />
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full shadow-lg hover:bg-destructive/90 transition-colors"
                            title="Remove image"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                {audioUrl && (
                    <div className="relative inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
                        <audio controls src={audioUrl} className="h-6 w-32" />
                        <button
                            onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                            className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <form className="flex items-center gap-2" onSubmit={handleSendMessage}>
                    <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-muted-foreground hover:text-primary hover:bg-white"
                                disabled={uploading || isRecording}
                                title="Attach Image"
                            >
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top">
                            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                <Smartphone className="w-4 h-4 mr-2" />
                                From Device
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={startCamera}>
                                <Camera className="w-4 h-4 mr-2" />
                                Take Photo
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        type="button"
                        variant={isRecording ? "destructive" : "ghost"}
                        size="icon"
                        className={`rounded-full transition-all duration-300 ${isRecording ? 'animate-pulse scale-110 shadow-red-500/20 shadow-lg' : 'text-muted-foreground hover:text-primary hover:bg-white'}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        title={isRecording ? "Stop Recording" : "Voice Message / Dictate"}
                    >
                        {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>
                    <Input
                        placeholder="Type a message..."
                        className="flex-1 bg-white border-slate-200 focus:border-primary/50 focus:ring-primary/20 rounded-full h-11"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="rounded-full h-11 w-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                        disabled={(!newMessage.trim() && !selectedImage && !audioBlob) || uploading || isRecording}
                        title="Send Message"
                    >
                        <Send className="w-5 h-5" />
                    </Button>
                </form>
            </div>
            {/* Camera Dialog */}
            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="sm:max-w-md bg-black/90 border-slate-800 text-white">
                    <div className="flex flex-col items-center space-y-4">
                        <h3 className="text-lg font-bold">Take Photo</h3>
                        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border-2 border-slate-700">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                            <canvas ref={canvasRef} className="hidden"></canvas>
                        </div>
                        <div className="flex justify-center gap-4 w-full">
                            <Button variant="outline" onClick={stopCamera} className="rounded-full bg-transparent text-white border-white/20 hover:bg-white/10">
                                Cancel
                            </Button>
                            <Button onClick={capturePhoto} className="rounded-full bg-white text-black hover:bg-white/90 px-8">
                                <Camera className="w-4 h-4 mr-2" />
                                Capture
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const ChatSheet = ({ patientContext, customButton }: ChatSheetProps) => {
    const { user, token } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const isOpenRef = useRef(false);
    const socketRef = useRef<any>(null);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!user) return;

        // Initial fetch
        fetchUnreadCount();

        // Socket for live updates
        const socket = io(API_BASE_URL);
        socketRef.current = socket;

        const roomId = patientContext?.id
            ? `patient-chat-${patientContext.id}`
            : user.icu_id
                ? `icu-chat-${user.icu_id}`
                : `hospital-${user.hospital_id}`;

        if (patientContext?.id) {
            socket.emit('join-patient', patientContext.id);
        } else if (user.icu_id) {
            socket.emit('join-icu', user.icu_id);
        } else {
            socket.emit('join-hospital', user.hospital_id);
        }

        socket.on('receive-message', (message: Message) => {
            if (isOpenRef.current) {
                markAsRead();
            } else if (message.sender_id !== user?.doctor_id) {
                setUnreadCount(prev => prev + 1);
            }
        });

        socket.on('messages-read', (data: any) => {
            // Reset count if anyone marks messages as read in this context
            const isMatch = data.patientId
                ? data.patientId == patientContext?.id
                : data.icuId
                    ? (data.icuId == (patientContext?.icuId || user.icu_id) && !patientContext?.id)
                    : (!patientContext?.id && !user.icu_id);

            if (isMatch) {
                setUnreadCount(0);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [user, patientContext?.id]);

    const fetchUnreadCount = async () => {
        try {
            let url = `${API_BASE_URL}/api/messages/unread-count/${user?.hospital_id}`;
            const params = new URLSearchParams();
            if (patientContext?.id) params.append('patientId', patientContext.id.toString());
            else if (user?.icu_id) params.append('icuId', user.icu_id.toString());

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.count);
            }
        } catch (error) {
            console.error("Failed to fetch unread count", error);
        }
    };

    const markAsRead = async () => {
        try {
            await fetch(`${API_BASE_URL}/api/messages/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hospitalId: user?.hospital_id,
                    icuId: patientContext?.icuId || user?.icu_id,
                    patientId: patientContext?.id
                })
            });
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to mark messages as read", error);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            markAsRead();
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={handleOpenChange}>
            <SheetTrigger asChild>
                <div className="relative">
                    {customButton ? customButton : (
                        <Button variant="outline" className="w-full flex items-center justify-center gap-4 bg-white/40 backdrop-blur-xl border border-white/20 hover:bg-white/60 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-500 shadow-sm rounded-2xl h-14 px-6 text-slate-700 active:scale-[0.98] group">
                            <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-all duration-500">
                                <MessageSquare className="w-4 h-4 text-primary" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-slate-900 transition-colors whitespace-nowrap">
                                Clinical Chat
                            </span>
                        </Button>
                    )}
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[11px] font-black text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-4 ring-white animate-in zoom-in duration-500">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] p-0 bg-transparent border-none">
                <ChatView patientContext={patientContext} />
            </SheetContent>
        </Sheet>
    );
};

export default ChatSheet;
