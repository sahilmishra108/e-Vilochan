import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileVideo, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { monitorROIs, VitalsData } from '@/types/vitals';

const VideoProcessor = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const { toast } = useToast();

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
      
      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameInterval;
        const imageBase64 = await extractFrameFromVideo(video, time);
        
        // Process frame with AI
        const { data, error } = await supabase.functions.invoke('extract-vitals', {
          body: { imageBase64, rois: monitorROIs }
        });
        
        if (!error && data?.vitals) {
          allVitals.push({
            ...data.vitals,
            timestamp: time
          });
        }
        
        setProgress(Math.round(((i + 1) / totalFrames) * 100));
      }
      
      // Generate CSV
      const csvContent = generateCSV(allVitals);
      downloadCSV(csvContent, `vitals-${Date.now()}.csv`);
      
      toast({
        title: "Processing complete",
        description: `Extracted ${allVitals.length} data points`,
      });
      
      URL.revokeObjectURL(video.src);
    } catch (error) {
      console.error('Error processing video:', error);
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

  const generateCSV = (data: Array<VitalsData & { timestamp: number }>) => {
    const headers = ['Timestamp', 'HR (bpm)', 'Pulse (bpm)', 'SpO2 (%)', 'ABP (mmHg)', 'PAP (mmHg)', 'EtCO2 (mmHg)', 'awRR (/min)'];
    const rows = data.map(row => [
      row.timestamp.toFixed(2),
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
    <Card className="p-6 bg-card border-border">
      <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-4">
        <FileVideo className="w-6 h-6 text-primary" />
        Video Processor
      </h2>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          id="video-upload"
        />
        
        <label htmlFor="video-upload" className="cursor-pointer">
          <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground mb-2">
            Drop video file here or click to browse
          </p>
          <p className="text-sm text-muted-foreground">
            Supported formats: MP4, MOV, AVI
          </p>
        </label>
      </div>
      
      {videoFile && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <FileVideo className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{videoFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            <Button 
              onClick={processVideo} 
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing {progress}%
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Extract & Download CSV
                </>
              )}
            </Button>
          </div>
          
          {isProcessing && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default VideoProcessor;