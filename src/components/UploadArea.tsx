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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const validateFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/x-zip-compressed'];
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.zip')) {
      setError("Invalid file format. Only PDF, ZIP, JPEG, PNG, and WebP are allowed.");
      return false;
    }
    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds maximum size of 10MB.");
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setSuccess(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);

      // Create a unique file name to prevent overwriting
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('secure-shares')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setSuccess(true);
      setSelectedFile(null);
      onUploadSuccess();

      // Reset success state after a few seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || "Failed to upload file. Ensure your Supabase setup is complete.");
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
          selectedFile && !isGlobal ? "hidden" : "flex",
          isGlobal && selectedFile ? "hidden" : "flex"
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
          className="hidden" 
          accept=".pdf,.zip,image/png,image/jpeg,image/webp" 
          onChange={handleChange}
        />
        <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
        <p className="text-sm text-slate-300 font-medium text-center">
          Drag & drop protocol
        </p>
        <p className="text-xs text-slate-500 mt-1">
          PDF, ZIP, PNG, JPG up to 10MB
        </p>
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col items-center relative pointer-events-auto">
          <button 
            onClick={() => {
              setSelectedFile(null);
              if (onDismiss) onDismiss();
            }}
            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-400 transition-colors"
            disabled={uploading}
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="bg-slate-800 p-3 rounded-lg mb-3">
            {selectedFile.name.toLowerCase().endsWith('.pdf') ? (
              <File className="w-8 h-8 text-rose-400" />
            ) : selectedFile.name.toLowerCase().endsWith('.zip') ? (
              <Archive className="w-8 h-8 text-amber-400" />
            ) : (
              <ImageIcon className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          
          <p className="text-sm text-slate-200 font-medium truncate max-w-full px-4">
            {selectedFile.name}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Encrypting & Transmitting...
              </>
            ) : (
              'Initiate Upload'
            )}
          </button>
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
