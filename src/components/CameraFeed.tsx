import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Square, Loader2, AlertTriangle, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { io } from 'socket.io-client';
import { extractVitalsWithOCR, OCRProgress } from '@/lib/ocr';
import { monitorROIs, VitalsData } from '@/types/vitals';
import VitalCard from './VitalCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CameraFeedProps {
  patientId?: string | null;
}

const CameraFeed = ({ patientId }: CameraFeedProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [latestVitals, setLatestVitals] = useState<VitalsData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Connect to Socket.io server
    const socket = io('http://localhost:3000');

    if (patientId) {
      socket.emit('join-patient', patientId);
    }

    socket.on('vital-update', (newVital: any) => {
      if (newVital.source === 'camera') {
        // If patientId is set, only update if it matches (backend sends to room, so it should match)
        // But if backend sends global update, we might need to check patient_id
        if (patientId && newVital.patient_id && newVital.patient_id.toString() !== patientId) {
          return;
        }

        setLatestVitals({
          HR: newVital.hr,
          Pulse: newVital.pulse,
          SpO2: newVital.spo2,
          ABP: newVital.abp,
          PAP: newVital.pap,
          EtCO2: newVital.etco2,
          awRR: newVital.awrr
        });

        setVitalsHistory(prev => {
          const newHistory = [...prev, {
            time: new Date().toLocaleTimeString(),
            HR: newVital.hr,
            SpO2: newVital.spo2
          }];
          return newHistory.slice(-20);
        });
      }
    });

    return () => {
      stopCapture();
      socket.disconnect();
    };
  }, [patientId]);

  const startCapture = async () => {
    // Clear previous errors
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera not supported in this browser. Use Chrome/Edge/Firefox on a secure context (localhost/HTTPS).');
        return;
      }

      // Try more forgiving constraints — device may not support 1080p
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (err) {
        // If we got overconstrained, try without constraints
        const e = err as Error & { name?: string };
        if (e && e.name === 'OverconstrainedError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (nestedErr) {
            throw nestedErr;
          }
        } else {
          throw err;
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { videoRef.current.play(); } catch (e) { /* ignore */ }
        setIsCapturing(true);

        // Capture frame every 3 seconds
        intervalRef.current = setInterval(() => {
          captureAndProcess();
        }, 3000);

        toast({
          title: "Camera started",
          description: "Capturing frames every 3 seconds",
        });
      }
    } catch (error) {
      // Provide more explicit error messages
      const e = error as Error & { name?: string };
      console.error('Camera error', e);
      let msg = 'Failed to access camera. Check your browser permissions/device.';

      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError')) {
        msg = 'Camera permission denied. Please allow camera access in your browser and try again.';
      } else if (e && e.name === 'NotFoundError') {
        msg = 'No camera device found. Attach or enable a camera, then retry.';
      } else if (e && e.name === 'NotReadableError') {
        msg = 'Camera is already in use by another application. Close other apps and try again.';
      } else if (e && e.name === 'OverconstrainedError') {
        msg = 'Camera does not support the requested resolution. Try a lower resolution or a different device.';
      } else if (e?.message) {
        msg = 'Failed to access camera: ' + e.message;
      }

      setCameraError(msg);
      toast({
        title: 'Camera error',
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

    setIsCapturing(false);
    setPreviewUrl(null);
  };

  const captureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image as base64
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.95);
    setPreviewUrl(imageBase64);

    // Use Tesseract OCR to extract vitals 
    const ocrResult = await extractVitalsWithOCR(
      imageBase64,
      monitorROIs,
      (progress) => {
        setOcrProgress(progress);
      }
    );

    // Store in database if vitals were extracted
    if (ocrResult.vitals && Object.values(ocrResult.vitals).some(v => v !== null)) {
      try {
        const response = await fetch('http://localhost:3000/api/vitals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patient_id: patientId,
            hr: ocrResult.vitals.HR,
            pulse: ocrResult.vitals.Pulse,
            spo2: ocrResult.vitals.SpO2,
            abp: ocrResult.vitals.ABP,
            pap: ocrResult.vitals.PAP,
            etco2: ocrResult.vitals.EtCO2,
            awrr: ocrResult.vitals.awRR,
            source: 'camera'
          })
        });

        if (response.ok) {
          // Update latest vitals for display
          setLatestVitals(ocrResult.vitals);
          setVitalsHistory(prev => {
            const newHistory = [...prev, {
              time: new Date().toLocaleTimeString(),
              HR: ocrResult.vitals?.HR,
              SpO2: ocrResult.vitals?.SpO2
            }];
            return newHistory.slice(-20);
          });
        }
      } catch (error) {
        console.error('Failed to save vitals:', error);
      }
    }

    setIsProcessing(false);
    setOcrProgress(null);
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

          <div className="flex gap-2">
            {!isCapturing ? (
              <Button onClick={() => { setCameraError(null); startCapture(); }} className="bg-primary hover:bg-primary/90 rounded-full shadow-lg hover:shadow-primary/25 transition-all hover:scale-105">
                <Camera className="w-4 h-4 mr-2" />
                Start Capture
              </Button>
            ) : (
              <Button onClick={stopCapture} variant="destructive" className="rounded-full shadow-lg hover:shadow-red-500/25 transition-all hover:scale-105">
                <Square className="w-4 h-4 mr-2" />
                Stop Capture
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-mono text-red-500 font-bold tracking-widest">REC</span>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
            />
            <canvas ref={canvasRef} className="hidden" />

            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-md bg-primary/50 animate-pulse"></div>
                  <Loader2 className="w-10 h-10 text-white animate-spin relative z-10" />
                </div>
                {ocrProgress && (
                  <div className="text-white text-center px-6 py-3 bg-black/40 rounded-xl backdrop-blur-md border border-white/10">
                    <p className="text-sm font-medium mb-2">{ocrProgress.message}</p>
                    <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                        style={{ width: `${ocrProgress.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] mt-1.5 text-white/60 font-mono">{ocrProgress.progress}%</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-950 rounded-2xl p-1 border-4 border-slate-800 shadow-2xl flex flex-col">
            <div className="bg-slate-900/50 p-3 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Processed Frame</h3>
              <span className="text-[10px] text-slate-500 font-mono">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex-1 flex items-center justify-center bg-slate-900/30 p-4">
              {previewUrl ? (
                <img src={previewUrl} alt="Last frame" className="w-full h-auto rounded-lg border border-slate-700/50 shadow-lg" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-600">
                  <Camera className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">No frame captured yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          {isCapturing && (
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Capturing every 3 seconds
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="h-[300px] w-full bg-white/40 backdrop-blur-sm border border-white/20 rounded-2xl p-4 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitalsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="HR" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="SpO2" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CameraFeed;