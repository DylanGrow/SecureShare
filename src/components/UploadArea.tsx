import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UploadCloud, File, Image as ImageIcon, X, CheckCircle2, Loader2, Archive } from 'lucide-react';
import { cn } from '../lib/utils';

interface UploadAreaProps {
  onUploadSuccess: () => void;
  isGlobal?: boolean;
  onDismiss?: () => void;
}

export function UploadArea({ onUploadSuccess, isGlobal, onDismiss }: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFiles = (filesList: FileList | File[]) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/x-zip-compressed'];
    const validFiles: File[] = [];
    
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.zip')) {
        setError(`Invalid format: ${file.name}. Only PDF, ZIP, JPEG, PNG, WebP allowed.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`Too large: ${file.name}. Max 10MB.`);
        continue;
      }
      validFiles.push(file);
    }
    return validFiles;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setSuccess(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const valid = validateFiles(e.dataTransfer.files);
      if (valid.length > 0) setSelectedFiles(prev => [...prev, ...valid]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (e.target.files && e.target.files.length > 0) {
      const valid = validateFiles(e.target.files);
      if (valid.length > 0) setSelectedFiles(prev => [...prev, ...valid]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFiles.length === 1 && onDismiss) onDismiss();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      // Simulate smooth progress bar for UI
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }, 100);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('secure-shares')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;
      }

      clearInterval(interval);
      setUploadProgress(100);
      setSuccess(true);
      
      setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress(0);
        onUploadSuccess();
        setSuccess(false);
        if (onDismiss) onDismiss();
      }, 1000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || "Failed to upload file(s).");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Dropzone */}
      <div 
        className={cn(
          "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors duration-200 ease-in-out cursor-pointer pointer-events-auto",
          dragActive || isGlobal ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800",
          selectedFiles.length > 0 && !isGlobal ? "hidden" : "flex",
          isGlobal && selectedFiles.length > 0 ? "hidden" : "flex"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          multiple
          className="hidden" 
          accept=".pdf,.zip,image/png,image/jpeg,image/webp" 
          onChange={handleChange}
        />
        <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
        <p className="text-sm text-slate-300 font-medium text-center">
          Drag & drop multiple files
        </p>
        <p className="text-xs text-slate-500 mt-1">
          PDF, ZIP, PNG, JPG up to 10MB each
        </p>
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col relative pointer-events-auto max-h-64 overflow-y-auto">
          {isGlobal && (
            <button 
              onClick={() => { setSelectedFiles([]); if (onDismiss) onDismiss(); }}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-400 transition-colors z-10"
              disabled={uploading}
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="space-y-2 mb-4 pr-6">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center space-x-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                {file.name.toLowerCase().endsWith('.pdf') ? (
                  <File className="w-6 h-6 text-rose-400 flex-shrink-0" />
                ) : file.name.toLowerCase().endsWith('.zip') ? (
                  <Archive className="w-6 h-6 text-amber-400 flex-shrink-0" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => removeSelectedFile(idx)} 
                  disabled={uploading}
                  className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button & Animated Progress */}
          <div className="relative overflow-hidden rounded-lg mt-auto">
            {uploading && (
              <div 
                className="absolute top-0 left-0 h-full bg-blue-600/30 transition-all duration-300 ease-out z-0" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            )}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="relative z-10 w-full bg-blue-600/90 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-80 disabled:cursor-not-allowed border border-blue-500/50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Encrypting... {uploadProgress}%
                </>
              ) : (
                `Initiate Upload (${selectedFiles.length})`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 p-3 rounded border border-red-400/20 text-center">
          {error}
        </div>
      )}
      
      {success && (
        <div className="text-xs text-emerald-400 bg-emerald-400/10 p-3 rounded border border-emerald-400/20 flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Upload verified and secured.</span>
        </div>
      )}
    </div>
  );
}
