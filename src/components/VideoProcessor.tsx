import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileVideo, Download, Loader2, FileSpreadsheet, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { io } from 'socket.io-client';
import { batchExtractVitals, OCRProgress } from '@/lib/ocr';
import { monitorROIs, VitalsData } from '@/types/vitals';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface VideoProcessorProps {
  patientId?: string | null;
}

const VideoProcessor = ({ patientId }: VideoProcessorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [latestVitals, setLatestVitals] = useState<VitalsData | null>(null);
  const [allExtractedVitals, setAllExtractedVitals] = useState<Array<VitalsData & { timestamp: number; timeString: string }>>([]);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Connect to Socket.io server
    const socket = io('http://localhost:3000');

    if (patientId) {
      socket.emit('join-patient', patientId);
    }

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.on('vital-update', (newVital: any) => {
      if (newVital.source === 'video') {
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
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [patientId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));

    if (videoFile) {
      setVideoFile(videoFile);
      setAllExtractedVitals([]);
      setLatestVitals(null);
      setVitalsHistory([]);
      toast({
        title: "Video loaded",
        description: videoFile.name,
      });
    } else {
      toast({
        title: "Invalid file",
        description: "Please drop a video file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setAllExtractedVitals([]);
      setLatestVitals(null);
      setVitalsHistory([]);
      toast({
        title: "Video loaded",
        description: file.name,
      });
    }
  };

  const extractFrameFromVideo = async (video: HTMLVideoElement, time: number): Promise<string> => {
    return new Promise((resolve) => {
      video.currentTime = time;
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
    });
  };

  const processVideo = async () => {
    if (!videoFile) return;

    setIsProcessing(true);
    setProgress(0);
    setVitalsHistory([]);

    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const duration = video.duration;
      const frameInterval = 3; // Extract frame every 3 seconds
      const totalFrames = Math.floor(duration / frameInterval);
      const allVitals: Array<VitalsData & { timestamp: number }> = [];

      // Extract all frames first
      const frames: string[] = [];
      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameInterval;
        const imageBase64 = await extractFrameFromVideo(video, time);
        frames.push(imageBase64);
        setProgress(Math.round(((i + 1) / totalFrames) * 50)); // First 50% for frame extraction
      }

      // Process all frames with Tesseract OCR
      const ocrResults = await batchExtractVitals(
        frames,
        monitorROIs,
        (current, total, imageProgress) => {
          if (imageProgress) {
            setOcrProgress(imageProgress);
            // Second 50% for OCR processing
            const baseProgress = 50;
            const ocrProgressPercent = (imageProgress.progress / 100) * 50;
            setProgress(Math.round(baseProgress + ocrProgressPercent));
          } else {
            setProgress(Math.round(50 + ((current / total) * 50)));
          }
        }
      );

      // Combine OCR results with timestamps and store in database
      const baseTimestamp = new Date();
      const vitalsToInsert: Array<{
        patient_id: string | null | undefined;
        hr: number | null;
        pulse: number | null;
        spo2: number | null;
        abp: string | null;
        pap: string | null;
        etco2: number | null;
        awrr: number | null;
        source: string;
        created_at: string;
      }> = [];

      const extractedVitalsWithTime: Array<VitalsData & { timestamp: number; timeString: string }> = [];

      for (let i = 0; i < ocrResults.length; i++) {
        const time = i * frameInterval;
        if (ocrResults[i].vitals) {
          const vitals = ocrResults[i].vitals;
          const timeString = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

          allVitals.push({
            ...vitals,
            timestamp: time
          });

          extractedVitalsWithTime.push({
            ...vitals,
            timestamp: time,
            timeString
          });

          // Update latest vitals for display during processing
          setLatestVitals(vitals);

          // Update history for chart
          setVitalsHistory(prev => {
            const newHistory = [...prev, {
              time: timeString,
              HR: vitals.HR,
              SpO2: vitals.SpO2
            }];
            return newHistory; // Keep all history for video analysis
          });

          // Prepare vitals for database insertion
          // Use the video timestamp to create a realistic created_at time
          const recordTimestamp = new Date(baseTimestamp.getTime() + time * 1000);
          vitalsToInsert.push({
            patient_id: patientId,
            hr: vitals.HR,
            pulse: vitals.Pulse,
            spo2: vitals.SpO2,
            abp: vitals.ABP,
            pap: vitals.PAP,
            etco2: vitals.EtCO2,
            awrr: vitals.awRR,
            source: 'video',
            created_at: recordTimestamp.toISOString()
          });
        }
      }

      // Update all extracted vitals for table display
      setAllExtractedVitals(extractedVitalsWithTime);

      // Store all vitals in database via API
      if (vitalsToInsert.length > 0) {
        try {
          const response = await fetch('http://localhost:3000/api/vitals', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(vitalsToInsert)
          });

          if (!response.ok) {
            throw new Error('Failed to save vitals');
          }

          toast({
            title: "Success",
            description: `Extracted and saved ${vitalsToInsert.length} vitals to dashboard`,
          });
        } catch (error) {
          console.error('Save error:', error);
          toast({
            title: "Warning",
            description: "Vitals extracted but failed to save to dashboard. CSV download available.",
            variant: "destructive",
          });
        }
      }

      // Generate CSV
      const csvContent = generateCSV(allVitals);
      downloadCSV(csvContent, `vitals-${Date.now()}.csv`);

      if (vitalsToInsert.length === 0) {
        toast({
          title: "Processing complete",
          description: `Extracted ${allVitals.length} data points`,
        });
      }

      URL.revokeObjectURL(video.src);
    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const generateCSV = (data: Array<VitalsData & { timestamp: number; timeString?: string }>) => {
    const headers = ['Time', 'HR (bpm)', 'Pulse (bpm)', 'SpO2 (%)', 'ABP (mmHg)', 'PAP (mmHg)', 'EtCO2 (mmHg)', 'awRR (/min)'];
    const rows = data.map(row => [
      row.timeString || `${Math.floor(row.timestamp / 60)}:${String(Math.floor(row.timestamp % 60)).padStart(2, '0')}`,
      row.HR ?? 'N/A',
      row.Pulse ?? 'N/A',
      row.SpO2 ?? 'N/A',
      row.ABP ?? 'N/A',
      row.PAP ?? 'N/A',
      row.EtCO2 ?? 'N/A',
      row.awRR ?? 'N/A'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="p-8 bg-white/60 backdrop-blur-md border-white/20 shadow-lg rounded-2xl">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <FileVideo className="w-6 h-6" />
          </div>
          Video Analysis
        </h2>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-3 border-dashed rounded-2xl p-16 text-center transition-all duration-300 group ${isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50/50'
            }`}
        >
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="video-upload"
          />

          <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${isDragging ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
              <Upload className="w-10 h-10" />
            </div>
            <p className="text-xl font-bold text-slate-700 mb-2">
              Drop video here or click to upload
            </p>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Support for MP4, MOV, or AVI files. We'll extract vitals automatically.
            </p>
          </label>
        </div>

        {videoFile && (
          <div className="mt-8 space-y-6 animate-slide-in-right">
            <div className="flex items-center justify-between p-6 bg-white/50 backdrop-blur-sm border border-white/20 rounded-xl shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileVideo className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">{videoFile.name}</p>
                  <p className="text-sm text-slate-500 font-medium">
                    {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <Button
                onClick={processVideo}
                disabled={isProcessing}
                className={`rounded-full px-6 py-6 shadow-lg transition-all ${isProcessing ? 'bg-slate-100 text-slate-500' : 'bg-primary hover:bg-primary/90 hover:scale-105 hover:shadow-primary/25'}`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing... {progress}%
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Extract & Download CSV
                  </>
                )}
              </Button>
            </div>

            {isProcessing && (
              <div className="space-y-3 p-6 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span className="text-slate-700">Processing Video</span>
                  <span className="text-primary">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                {ocrProgress && (
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                    <p className="font-medium flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {ocrProgress.message}
                    </p>
                    <p className="font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-600">OCR: {ocrProgress.status}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Real-time Chart */}
        {(vitalsHistory.length > 0 || isProcessing) && (
          <div className="mt-8 animate-fade-in">
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Extraction Trends
            </h3>
            <div className="h-[350px] w-full bg-white/40 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-inner">
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
        )}

        {/* Vitals Table */}
        {allExtractedVitals.length > 0 && (
          <div className="mt-8 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">All Extracted Vitals</h3>
              <Button
                onClick={() => {
                  const csvContent = generateCSV(allExtractedVitals);
                  downloadCSV(csvContent, `vitals-table-${Date.now()}.csv`);
                  toast({
                    title: "Export successful",
                    description: "Vitals table exported to CSV",
                  });
                }}
                variant="outline"
                className="gap-2 rounded-full border-slate-200 hover:bg-slate-50 hover:text-primary"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Table to CSV
              </Button>
            </div>

            <Card className="border-white/20 shadow-lg overflow-hidden rounded-2xl bg-white/40 backdrop-blur-md">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-slate-700">Time</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">HR (bpm)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Pulse (bpm)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">SpO2 (%)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">ABP (mmHg)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">PAP (mmHg)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">EtCO2 (mmHg)</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">awRR (/min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allExtractedVitals.map((vital, index) => (
                      <TableRow key={index} className="hover:bg-white/60 border-b border-slate-100/50 transition-colors">
                        <TableCell className="font-medium text-slate-600 bg-slate-50/30">{vital.timeString}</TableCell>
                        <TableCell className="text-center font-semibold text-rose-600">{vital.HR ?? '-'}</TableCell>
                        <TableCell className="text-center font-semibold text-rose-400">{vital.Pulse ?? '-'}</TableCell>
                        <TableCell className="text-center font-semibold text-cyan-600">{vital.SpO2 ?? '-'}</TableCell>
                        <TableCell className="text-center text-amber-600">{vital.ABP ?? '-'}</TableCell>
                        <TableCell className="text-center text-amber-600">{vital.PAP ?? '-'}</TableCell>
                        <TableCell className="text-center font-semibold text-emerald-600">{vital.EtCO2 ?? '-'}</TableCell>
                        <TableCell className="text-center font-semibold text-blue-600">{vital.awRR ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50/50">
                <p className="text-sm text-slate-500">
                  Total records: <span className="font-bold text-slate-800">{allExtractedVitals.length}</span>
                </p>
              </div>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VideoProcessor;