
import React, { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileVideo, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { batchExtractVitals, OCRProgress } from '@/lib/ocr';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config';
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
  const { authFetch } = useAuth();

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
      const frameInterval = 30; // Extract frame every 30 seconds
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
        },
        authFetch
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
          const timeString = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')} `;

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
          const response = await authFetch(`${API_BASE_URL}/api/vitals`, {
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
      downloadCSV(csvContent, `vitals - ${Date.now()}.csv`);

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
      row.timeString || `${Math.floor(row.timestamp / 60)}:${String(Math.floor(row.timestamp % 60)).padStart(2, '0')} `,
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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl shadow-lg shadow-primary/10">
            <FileVideo className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Clinical Video Analysis</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">AI-powered vital sign extraction from monitor recordings</p>
          </div>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-3 border-dashed rounded-3xl p-20 text-center transition-all duration-500 group overflow-hidden ${isDragging
          ? 'border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent scale-[1.01] shadow-2xl shadow-primary/20'
          : 'border-slate-200 hover:border-primary/40 hover:bg-gradient-to-br hover:from-slate-50/80 hover:to-transparent hover:shadow-xl'
          }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          id="video-upload"
        />

        <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center relative z-10">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 transition-all duration-500 shadow-lg ${isDragging
            ? 'bg-gradient-to-br from-primary/30 to-secondary/30 text-primary scale-110 shadow-primary/30'
            : 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400 group-hover:from-primary/20 group-hover:to-secondary/20 group-hover:text-primary group-hover:scale-105 group-hover:shadow-xl'
            }`}>
            <Upload className="w-12 h-12" />
          </div>
          <p className="text-2xl font-extrabold text-slate-800 mb-3 tracking-tight">
            Upload Clinical Monitor Recording
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            Drag and drop your video file here, or click to browse. Supports MP4, MOV, and AVI formats.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 font-mono">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI extraction ready</span>
          </div>
        </label>
      </div>

      {videoFile && (
        <div className="mt-8 space-y-6 animate-slide-in-right">
          <div className="flex items-center justify-between p-8 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center shadow-lg shadow-blue-500/10">
                <FileVideo className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="font-extrabold text-slate-900 text-xl tracking-tight">{videoFile.name}</p>
                <p className="text-sm text-slate-500 font-semibold mt-1">
                  {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for analysis
                </p>
              </div>
            </div>

            <Button
              onClick={processVideo}
              disabled={isProcessing}
              className={`rounded-full px-8 py-7 shadow-xl transition-all duration-300 font-bold text-base ${isProcessing
                ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary hover:scale-105 hover:shadow-2xl hover:shadow-primary/30 text-white'
                }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Processing {progress}%
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-3" />
                  Start Extraction
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
                  style={{ width: `${progress}% ` }}
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
          <Card className="p-6 bg-white/60 backdrop-blur-md border-white/20 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Extracted Vitals Trend
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitalsHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="HR"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name="Heart Rate"
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="SpO2"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name="SpO2"
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Data Table */}
      {allExtractedVitals.length > 0 && (
        <div className="mt-8 animate-fade-in">
          <Card className="p-0 overflow-hidden bg-white/60 backdrop-blur-md border-white/20 shadow-lg">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Detailed Data Points
              </h3>
              <Button variant="outline" size="sm" onClick={() => {
                const csv = generateCSV(allExtractedVitals);
                downloadCSV(csv, 'vitals_export.csv');
              }}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>HR (bpm)</TableHead>
                    <TableHead>Pulse (bpm)</TableHead>
                    <TableHead>SpO2 (%)</TableHead>
                    <TableHead>ABP (mmHg)</TableHead>
                    <TableHead>PAP (mmHg)</TableHead>
                    <TableHead>EtCO2</TableHead>
                    <TableHead>awRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allExtractedVitals.map((row, i) => (
                    <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-mono text-xs">{row.timeString}</TableCell>
                      <TableCell className="font-medium text-slate-700">{row.HR || '-'}</TableCell>
                      <TableCell>{row.Pulse || '-'}</TableCell>
                      <TableCell>{row.SpO2 || '-'}</TableCell>
                      <TableCell>{row.ABP || '-'}</TableCell>
                      <TableCell>{row.PAP || '-'}</TableCell>
                      <TableCell>{row.EtCO2 || '-'}</TableCell>
                      <TableCell>{row.awRR || '-'}</TableCell>
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

    </div >
  );
};

export default VideoProcessor;