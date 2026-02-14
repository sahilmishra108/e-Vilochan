import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Camera, Square, Loader2, AlertTriangle, Activity, RefreshCw, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast';
import { io } from 'socket.io-client';
import { extractVitalsWithOCR, OCRProgress } from '@/lib/ocr';
import { monitorROIs, VitalsData, ROI } from '@/types/vitals';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config';
import VitalCard from './VitalCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Settings2, Save, X, MousePointer2 } from 'lucide-react';

interface CameraFeedProps {
  patientId?: string | null;
}

const CameraFeed = ({ patientId }: CameraFeedProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionInterval, setExtractionInterval] = useState(3000); // Default 3s
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [latestVitals, setLatestVitals] = useState<VitalsData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { authFetch, token, user } = useAuth();
  const socketRef = useRef<any>(null);

  // ROI Selection States
  const [isROIMode, setIsROIMode] = useState(false);
  const [customROIs, setCustomROIs] = useState<ROI[]>(monitorROIs);
  const [drawingROI, setDrawingROI] = useState<Partial<ROI> | null>(null);
  const [selectedROILabel, setSelectedROILabel] = useState<string>('HR');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize global socket
    socketRef.current = io(API_BASE_URL);

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    // Get available cameras
    const getCameras = async () => {
      try {
        // Request permission primarily to get labels, then stop immediately to release lock
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.warn("Could not get initial camera permission or stream:", err);
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);

        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };

    getCameras();

    return () => {
      stopCapture();
    };
  }, [patientId]);

  useEffect(() => {
    if (isCapturing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        captureAndProcess();
      }, extractionInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [extractionInterval, isCapturing]);

  const startCapture = async () => {
    // Clear previous errors
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera not supported in this browser. Use Chrome/Edge/Firefox on a secure context (localhost/HTTPS).');
      return;
    }

    try {
      let stream;

      // 1. First Attempt: 720p (HD)
      try {
        const hdConstraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } }
        };
        stream = await navigator.mediaDevices.getUserMedia(hdConstraints);
      } catch (err: any) {
        console.warn("HD capture failed, trying fallbacks...", err.name);

        // 2. Fallback Attempt: 480p (VGA)
        try {
          const vgaConstraints: MediaStreamConstraints = {
            video: selectedDeviceId
              ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
              : { width: { ideal: 640 }, height: { ideal: 480 } }
          };
          stream = await navigator.mediaDevices.getUserMedia(vgaConstraints);
          toast({ title: "Low Res Mode", description: "Switched to VGA resolution.", variant: "default" });
        } catch (vgaErr) {
          // 3. Ultimate Fallback: No resolution constraints (Let browser decide)
          console.warn("VGA failed, trying minimal constraints...");
          try {
            const minimalConstraints: MediaStreamConstraints = {
              video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
            };
            stream = await navigator.mediaDevices.getUserMedia(minimalConstraints);
            toast({ title: "Minimal Mode", description: "Opened camera with default settings.", variant: "default" });
          } catch (finalErr) {
            throw finalErr; // All attempts failed
          }
        }
      }

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (e) { /* ignore */ }
        setIsCapturing(true);

        // Initial capture and process will start via the useEffect above

        // Notify doctors that monitoring has started
        socketRef.current?.emit('monitoring-started', {
          hospital_id: user?.hospital_id,
          icu_id: user?.icu_id,
          patient_id: patientId,
          staff_name: user?.name || 'Staff'
        });

        toast({
          title: "Camera started",
          description: `Capturing frames every ${extractionInterval / 1000} seconds`,
        });
      }
    } catch (error) {
      // Provide more explicit error messages
      const e = error as Error & { name?: string; constraint?: string };
      console.error('Camera error', e);
      let msg = 'Failed to access camera.';

      if (e) {
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError') {
          msg = 'Camera permission denied. Please allow access.';
        } else if (e.name === 'NotFoundError') {
          msg = 'Camera device not found.';
        } else if (e.name === 'NotReadableError') {
          msg = 'Camera is in use or USB bandwidth is full.';
        } else if (e.name === 'OverconstrainedError') {
          msg = `Resolution not supported${e.constraint ? ` (${e.constraint})` : ''}.`;
        } else {
          msg = `Error: ${e.name} - ${e.message}`;
        }
      } else {
        msg = 'Unknown error occurred.';
      }

      setCameraError(msg);
      toast({
        title: 'Camera Error',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  const stopCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    // Notify doctors that monitoring has stopped
    socketRef.current?.emit('monitoring-stopped', {
      patient_id: patientId
    });

    setIsCapturing(false);
  };

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { status, progress, message, result } = e.data;

      if (status === 'initializing' || status === 'processing' || status === 'recognizing') {
        setOcrProgress({ status, progress, message });
      } else if (status === 'completed' && result) {
        setOcrProgress(null);
        setIsProcessing(false);

        // Handle successful result
        if (result.vitals && Object.values(result.vitals).some((v: any) => v !== null)) {
          handleVitalsUpdate(result.vitals);
        }
      } else if (status === 'error') {
        setOcrProgress(null);
        setIsProcessing(false);
        // console.error("Worker error:", message);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleVitalsUpdate = async (vitals: any) => {
    setLatestVitals(vitals);
    setVitalsHistory(prev => {
      const newHistory = [...prev, {
        time: new Date().toLocaleTimeString(),
        HR: vitals?.HR,
        SpO2: vitals?.SpO2
      }];
      return newHistory.slice(-20);
    });

    // Save to backend
    try {
      await authFetch(`${API_BASE_URL}/api/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          hr: vitals.HR,
          pulse: vitals.Pulse,
          spo2: vitals.SpO2,
          abp: vitals.ABP,
          pap: vitals.PAP,
          etco2: vitals.EtCO2,
          awrr: vitals.awRR,
          additional_data: vitals.additional_data,
          source: 'camera'
        })
      });
    } catch (error) {
      console.error('Failed to save vitals:', error);
    }

    // Broadcast to doctors via socket
    socketRef.current?.emit('vital-update', {
      ...vitals,
      patient_id: patientId,
      timestamp: new Date().toISOString()
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isROIMode || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setDrawingROI({
      label: selectedROILabel,
      x,
      y,
      width: 0,
      height: 0
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isROIMode || !drawingROI || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;

    setDrawingROI(prev => ({
      ...prev,
      width: currentX - (prev?.x || 0),
      height: currentY - (prev?.y || 0)
    }));
  };

  const handleMouseUp = () => {
    if (!isROIMode || !drawingROI) return;

    // Normalize if drawn backwards
    const finalROI: ROI = {
      label: drawingROI.label || selectedROILabel,
      x: drawingROI.width! < 0 ? drawingROI.x! + drawingROI.width! : drawingROI.x!,
      y: drawingROI.height! < 0 ? drawingROI.y! + drawingROI.height! : drawingROI.y!,
      width: Math.abs(drawingROI.width!),
      height: Math.abs(drawingROI.height!),
    };

    // Update customROIs
    setCustomROIs(prev => {
      const filtered = prev.filter(r => r.label !== finalROI.label);
      return [...filtered, finalROI];
    });

    setDrawingROI(null);
    toast({
      title: `${finalROI.label} Zone Set`,
      description: "Remember to save your layout after finishing.",
    });
  };

  const saveROIs = async () => {
    try {
      // For now, we'll store in local storage or could add a backend endpoint
      localStorage.setItem(`rois_${patientId}`, JSON.stringify(customROIs));
      setIsROIMode(false);
      toast({
        title: "Layout Saved",
        description: "Custom analysis zones updated successfully.",
      });
    } catch (err) {
      console.error("Failed to save ROIs", err);
    }
  };

  const captureAndProcess = () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

    const video = videoRef.current;

    // Check if video is ready
    if (video.readyState !== 4) return;

    if (isProcessing) return; // Added this line

    setIsProcessing(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image as base64
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.6); // Lower quality for streaming speed
    setPreviewUrl(imageBase64);

    // Offload to Worker
    workerRef.current.postMessage({
      imageBase64,
      rois: customROIs, // Use customROIs instead of monitorROIs
      token: token // Pass token to worker
    });
  };

  // Re-fetch function exposed to UI
  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      // If no device acts as selected but we have devices, select the first one
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }

      toast({ title: "Devices Refreshed", description: `Found ${videoDevices.length} camera(s)` });
    } catch (err) {
      console.error("Error refreshing devices:", err);
      toast({ title: "Refresh Failed", description: "Could not enumerate devices", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="p-6 bg-white/60 backdrop-blur-md border-white/20 shadow-lg rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Camera className="w-6 h-6" />
            </div>
            Live Camera Feed
          </h2>

          <div className="flex gap-2 items-center">
            {!isCapturing && (
              <Button variant="ghost" size="icon" onClick={refreshDevices} title="Refresh Camera List" className="mr-2">
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            {!isCapturing && devices.length > 0 && (
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="w-[180px] bg-slate-900/50 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Select Camera" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${devices.indexOf(device) + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-col gap-1.5 min-w-[120px] px-2">
              <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500 tracking-[0.1em]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary" />
                  <span>Interval</span>
                </div>
                <span className="text-primary font-mono">{extractionInterval / 1000}s</span>
              </div>
              <Slider
                value={[extractionInterval / 1000]}
                onValueChange={(vals) => setExtractionInterval(vals[0] * 1000)}
                min={3}
                max={30}
                step={1}
                className="w-full"
              />
            </div>

            {isCapturing && (
              <Button
                variant={isROIMode ? "secondary" : "ghost"}
                onClick={() => setIsROIMode(!isROIMode)}
                className="rounded-xl border border-white/10"
              >
                {isROIMode ? <X className="w-4 h-4 mr-2" /> : <Settings2 className="w-4 h-4 mr-2" />}
                {isROIMode ? "Cancel ROI Edit" : "Adjust Zones"}
              </Button>
            )}

            {isROIMode && (
              <Button onClick={saveROIs} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                <Save className="w-4 h-4 mr-2" />
                Save Layout
              </Button>
            )}

            {!isCapturing ? (
              <Button onClick={() => { setCameraError(null); startCapture(); }} className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 border-none px-6">
                <Camera className="w-4 h-4 mr-2" />
                Initiate Analysis
              </Button>
            ) : (
              <Button onClick={stopCapture} variant="destructive" className="rounded-xl shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95 border-none px-6">
                <Square className="w-4 h-4 mr-2" />
                End Monitoring
              </Button>
            )}
          </div>
        </div>

        <div className="w-full">
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl">
            {isCapturing && (
              <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-[10px] font-mono text-white font-bold tracking-widest">LIVE • ANALYSIS</span>
                </div>
                {isProcessing && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 backdrop-blur-md rounded-full border border-blue-500/30">
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    <span className="text-[10px] font-mono text-blue-400 font-bold tracking-widest uppercase">Syncing Vitals</span>
                  </div>
                )}
              </div>
            )}

            {/* Clinical HUD Overlay */}
            {isCapturing && latestVitals && (
              <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3 items-end animate-fade-in">
                <div className="clinical-hud px-4 py-3 rounded-2xl flex items-center gap-6 shadow-2xl border-white/10 ring-1 ring-white/5">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">HR</span>
                    <span className="text-2xl font-bold tracking-tight text-white">{latestVitals.HR || '--'}</span>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter text-blue-300">SpO2</span>
                    <span className="text-2xl font-bold tracking-tight text-blue-400">{latestVitals.SpO2 || '--'}%</span>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter text-emerald-300">ABP</span>
                    <span className="text-2xl font-bold tracking-tight text-emerald-400">{latestVitals.ABP || '--'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scanner Visual Effect */}
            {isProcessing && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent blur-sm z-30 animate-[scan_2s_ease-in-out_infinite]"></div>
            )}

            {/* ROI Editing Overlay */}
            {isROIMode && (
              <div
                className="absolute inset-0 z-50 cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                {/* Existing ROIs */}
                {customROIs.map((roi) => (
                  <div
                    key={roi.label}
                    className="absolute border-2 border-primary/50 bg-primary/10 flex items-center justify-center"
                    style={{
                      left: `${roi.x * 100}%`,
                      top: `${roi.y * 100}%`,
                      width: `${roi.width * 100}%`,
                      height: `${roi.height * 100}%`,
                    }}
                  >
                    <span className="text-[10px] font-black text-white bg-primary px-1 rounded">{roi.label}</span>
                  </div>
                ))}

                {/* Currently Drawing ROI */}
                {drawingROI && (
                  <div
                    className="absolute border-2 border-white bg-white/20"
                    style={{
                      left: `${Math.min(drawingROI.x!, drawingROI.x! + drawingROI.width!) * 100}%`,
                      top: `${Math.min(drawingROI.y!, drawingROI.y! + drawingROI.height!) * 100}%`,
                      width: `${Math.abs(drawingROI.width!) * 100}%`,
                      height: `${Math.abs(drawingROI.height!) * 100}%`,
                    }}
                  />
                )}

                {/* ROI Tool Selection */}
                <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md p-4 rounded-3xl border border-white/20 flex flex-col gap-3">
                  <p className="text-[10px] font-black text-white/60 tracking-widest uppercase mb-1">Select Vital to Define</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['HR', 'Pulse', 'SpO2', 'ABP', 'PAP', 'EtCO2', 'awRR'].map((label) => (
                      <Button
                        key={label}
                        variant={selectedROILabel === label ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedROILabel(label); }}
                        className="rounded-xl text-[10px] font-bold h-8"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[9px] text-white/40 mt-2 italic">Click and drag on screen to draw box</p>
                </div>
              </div>
            )}

            <div ref={containerRef} className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto aspect-video object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {ocrProgress && isProcessing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-40 transition-all">
                <div className="glass-card p-6 rounded-[2.5rem] border-white/10 shadow-2xl scale-90 animate-pulse">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-bold tracking-tight">{ocrProgress.message}</p>
                      <p className="text-primary text-[10px] font-mono mt-1 uppercase tracking-widest">{ocrProgress.progress}% COMPLETED</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          {isCapturing && (
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Capturing every {extractionInterval / 1000} seconds
            </p>
          )}

          {cameraError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Live KPIs */}
        <div className="mt-8 space-y-6">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Live Vitals Analysis
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <VitalCard
              label="HR"
              value={latestVitals?.HR ?? null}
              unit="bpm"
            />
            <VitalCard
              label="Pulse"
              value={latestVitals?.Pulse ?? null}
              unit="bpm"
            />
            <VitalCard
              label="SpO2"
              value={latestVitals?.SpO2 ?? null}
              unit="%"
            />
            <VitalCard
              label="EtCO2"
              value={latestVitals?.EtCO2 ?? null}
              unit="mmHg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <VitalCard
              label="ABP"
              value={latestVitals?.ABP ?? null}
              unit="mmHg"
            />
            <VitalCard
              label="PAP"
              value={latestVitals?.PAP ?? null}
              unit="mmHg"
            />
            <VitalCard
              label="awRR"
              value={latestVitals?.awRR ?? null}
              unit="/min"
            />
          </div>
        </div>

        {/* Real-time Chart */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-foreground mb-4">Real-Time Trends</h3>
          <div className="h-[300px] w-full bg-slate-900/5 backdrop-blur-sm border border-slate-200/20 rounded-2xl p-4 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vitalsHistory}>
                <defs>
                  <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSpO2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    fontSize: '12px',
                    color: '#1e293b'
                  }}
                  itemStyle={{ color: '#1e293b' }}
                  labelStyle={{ color: '#64748b', marginBottom: '0.5rem' }}
                />
                <Legend iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="HR"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorHR)"
                  animationDuration={500}
                />
                <Area
                  type="monotone"
                  dataKey="SpO2"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSpO2)"
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card >
    </div >
  );
};

export default CameraFeed;