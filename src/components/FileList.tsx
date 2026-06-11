import { useState, useEffect, useRef } from 'react';
import type { SharedFile } from '../App';
import { 
  FileText, Download, Loader2, Trash2, X, 
  AlertTriangle, Archive, Edit2, Save, Key, ShieldCheck, 
  Copy, QrCode, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { decryptFile } from '../lib/crypto';
import { parseFileName, formatBytes } from '../lib/utils';
import JSZip from 'jszip';
import QRCode from 'qrcode';

interface FileListProps {
  files: SharedFile[];
  loading: boolean;
  onFileUpdate: () => void;
  viewMode: 'grid' | 'list';
  selectedFileIds: string[];
  setSelectedFileIds: React.Dispatch<React.SetStateAction<string[]>>;
  autoOpenFile: SharedFile | null;
  clearAutoOpenFile: () => void;
}

export function FileList({ 
  files, 
  loading, 
  onFileUpdate, 
  viewMode,
  selectedFileIds,
  setSelectedFileIds,
  autoOpenFile,
  clearAutoOpenFile
}: FileListProps) {
  // Modal & Preview States
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; name: string } | null>(null);
  
  // Zip Explorer State
  const [zipContents, setZipContents] = useState<{ 
    file: SharedFile; 
    files: { path: string; size: number; isDir: boolean; fileEntry: any }[] 
  } | null>(null);
  
  // Share/QR Code State
  const [shareFile, setShareFile] = useState<SharedFile | null>(null);
  const [shareLinkType, setShareLinkType] = useState<'app' | 'direct'>('app');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // File Operation States
  const [fileToDelete, setFileToDelete] = useState<SharedFile | null>(null);
  const [fileToRename, setFileToRename] = useState<SharedFile | null>(null);
  const [newName, setNewName] = useState('');
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Client-Side Decryption States
  const [decryptedCache, setDecryptedCache] = useState<Record<string, { 
    blobUrl: string; 
    arrayBuffer: ArrayBuffer; 
    type: string; 
  }>>({});
  const [pendingAction, setPendingAction] = useState<{ 
    file: SharedFile; 
    type: 'view' | 'download' | 'zip' | 'share';
  } | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImage(null);
        setSelectedPdf(null);
        setZipContents(null);
        setShareFile(null);
        setFileToDelete(null);
        setFileToRename(null);
        setPendingAction(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (autoOpenFile) {
      handleFileAction(autoOpenFile, autoOpenFile.type === 'zip' ? 'zip' : 'view');
      clearAutoOpenFile();
    }
  }, [autoOpenFile]);

  // Generate QR Code when share link updates
  const shareUrl = shareFile ? (
    shareLinkType === 'app' 
      ? `${window.location.origin}${window.location.pathname}?file=${encodeURIComponent(shareFile.name)}`
      : shareFile.url
  ) : '';

  useEffect(() => {
    if (shareUrl && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        shareUrl,
        {
          width: 160,
          margin: 1,
          color: {
            dark: '#0f172a', // slate-900
            light: '#f8fafc' // slate-50
          }
        },
        (err) => {
          if (err) console.error("QR Code generation error:", err);
        }
      );
    }
  }, [shareUrl]);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to fetch file, decrypting if necessary
  const getFileBlob = async (file: SharedFile, password?: string): Promise<{ blob: Blob; blobUrl: string; arrayBuffer: ArrayBuffer }> => {
    const parsed = parseFileName(file.name);
    
    if (parsed.isEncrypted) {
      if (decryptedCache[file.id]) {
        const cached = decryptedCache[file.id];
        const blob = new Blob([cached.arrayBuffer], { type: cached.type });
        return { blob, blobUrl: cached.blobUrl, arrayBuffer: cached.arrayBuffer };
      }
      
      if (!password) {
        throw new Error("Passphrase required");
      }
      
      const res = await fetch(file.url);
      if (!res.ok) throw new Error("Failed to download encrypted file from storage.");
      const encBuffer = await res.arrayBuffer();
      
      try {
        const decBuffer = await decryptFile(encBuffer, password);
        
        // Determine original MIME type by extension
        const ext = parsed.originalName.split('.').pop()?.toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (ext === 'zip') mimeType = 'application/zip';
        else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        
        const blob = new Blob([decBuffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        
        // Cache decrypted version
        setDecryptedCache(prev => ({
          ...prev,
          [file.id]: { blobUrl, arrayBuffer: decBuffer, type: mimeType }
        }));
        
        return { blob, blobUrl, arrayBuffer: decBuffer };
      } catch (err) {
        throw new Error("Incorrect password or corrupted archive.");
      }
    } else {
      // Fetch public file as blob to prevent standard inline browser navigation
      const res = await fetch(file.url);
      if (!res.ok) throw new Error("Failed to fetch file.");
      const arrayBuffer = await res.arrayBuffer();
      
      const ext = parsed.originalName.split('.').pop()?.toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'zip') mimeType = 'application/zip';
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      
      return { blob, blobUrl, arrayBuffer };
    }
  };

  const handleCopyText = async (text: string, label: string = 'Text') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      toast.error('Failed to copy.');
    }
  };

  const handleFileAction = async (file: SharedFile, type: 'view' | 'download' | 'zip' | 'share') => {
    const parsed = parseFileName(file.name);
    
    // Check if decryption is needed and not already cached
    if (parsed.isEncrypted && !decryptedCache[file.id]) {
      setPendingAction({ file, type });
      setDecryptPassword('');
      setDecryptError(null);
      return;
    }

    try {
      toast.loading("Processing file...", { id: 'file-action' });
      const { blob, blobUrl } = await getFileBlob(file);
      toast.dismiss('file-action');

      if (type === 'view') {
        if (file.type === 'image') {
          setSelectedImage(blobUrl);
        } else if (file.type === 'pdf') {
          setSelectedPdf({ url: blobUrl, name: parsed.originalName });
        }
      } else if (type === 'download') {
        triggerDownload(blob, parsed.originalName);
      } else if (type === 'zip') {
        await handleOpenZipExplorer(file);
      } else if (type === 'share') {
        setShareFile(file);
      }
    } catch (err: any) {
      toast.error(err.message || "Action failed.");
    }
  };

  const handleDecryptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    
    setIsDecrypting(true);
    setDecryptError(null);
    
    try {
      const { blob, blobUrl } = await getFileBlob(pendingAction.file, decryptPassword);
      const parsed = parseFileName(pendingAction.file.name);
      
      if (pendingAction.type === 'view') {
        if (pendingAction.file.type === 'image') {
          setSelectedImage(blobUrl);
        } else if (pendingAction.file.type === 'pdf') {
          setSelectedPdf({ url: blobUrl, name: parsed.originalName });
        }
      } else if (pendingAction.type === 'download') {
        triggerDownload(blob, parsed.originalName);
      } else if (pendingAction.type === 'zip') {
        // Zip contents requires loading after blob fetch
        const zip = new JSZip();
        const contents = await zip.loadAsync(blob);
        const filesList: { path: string; size: number; isDir: boolean; fileEntry: any }[] = [];
        contents.forEach((relativePath, fileEntry) => {
          filesList.push({
            path: relativePath,
            size: (fileEntry as any)._data?.uncompressedSize || 0,
            isDir: fileEntry.dir,
            fileEntry: fileEntry
          });
        });
        setZipContents({ file: pendingAction.file, files: filesList });
      } else if (pendingAction.type === 'share') {
        setShareFile(pendingAction.file);
      }
      
      setPendingAction(null);
      setDecryptPassword('');
      toast.success("Decryption successful!");
    } catch (err: any) {
      console.error(err);
      setDecryptError(err.message || "Decryption failed. Please check password.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleOpenZipExplorer = async (file: SharedFile) => {
    try {
      const { blob } = await getFileBlob(file);
      const zip = new JSZip();
      const contents = await zip.loadAsync(blob);
      const filesList: { path: string; size: number; isDir: boolean; fileEntry: any }[] = [];
      contents.forEach((relativePath, fileEntry) => {
        filesList.push({
          path: relativePath,
          size: (fileEntry as any)._data?.uncompressedSize || 0,
          isDir: fileEntry.dir,
          fileEntry: fileEntry
        });
      });
      setZipContents({ file, files: filesList });
    } catch (err: any) {
      toast.error("Failed to parse ZIP archive: " + err.message);
    }
  };

  const handleExtractZipFile = async (fileEntry: any, path: string) => {
    try {
      toast.loading("Extracting...", { id: 'zip-extract' });
      const blob = await fileEntry.async('blob');
      const filename = path.split('/').pop() || 'extracted_file';
      triggerDownload(blob, filename);
      toast.success("File extracted!", { id: 'zip-extract' });
    } catch (err: any) {
      toast.error("Failed to extract: " + err.message, { id: 'zip-extract' });
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase.storage.from('secure-shares').remove([fileToDelete.name]);
      if (error) throw error;
      toast.success('Asset permanently deleted.');
      onFileUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete file.');
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  const handleRename = async () => {
    if (!fileToRename || !newName.trim() || newName === fileToRename.name) {
      setFileToRename(null);
      return;
    }
    
    const parsed = parseFileName(fileToRename.name);
    const oldExt = parsed.originalName.split('.').pop() || '';
    let cleanNewName = newName.trim();
    if (!cleanNewName.endsWith(`.${oldExt}`)) {
      cleanNewName = `${cleanNewName}.${oldExt}`;
    }

    // Reconstruct raw database filename preserving prefix & hashes
    const randomId = Math.random().toString(36).substring(2, 8);
    let finalRawName = '';
    if (parsed.isEncrypted) {
      finalRawName = `enc_${parsed.sha256 || 'hash'}_${randomId}_${cleanNewName}`;
    } else {
      finalRawName = `sec_${parsed.sha256 || 'hash'}_${randomId}_${cleanNewName}`;
    }

    try {
      setIsRenaming(true);
      const { error } = await supabase.storage.from('secure-shares').move(fileToRename.name, finalRawName);
      if (error) throw error;
      
      // Update cache references if it was cached
      if (decryptedCache[fileToRename.id]) {
        setDecryptedCache(prev => {
          const updated = { ...prev };
          // Keep cached decrypted data under the new name/ID
          updated[fileToRename.id] = prev[fileToRename.id];
          return updated;
        });
      }

      toast.success('Asset renamed successfully.');
      onFileUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename file.');
    } finally {
      setIsRenaming(false);
      setFileToRename(null);
    }
  };

  const toggleSelectFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId) 
        : [...prev, fileId]
    );
  };

  const handleBulkDownload = async () => {
    if (selectedFileIds.length === 0) return;
    try {
      toast.loading("Zipping assets in browser...", { id: 'bulk-download' });
      const zip = new JSZip();
      
      for (const fileId of selectedFileIds) {
        const file = files.find(f => f.id === fileId);
        if (!file) continue;
        
        const parsed = parseFileName(file.name);
        let arrayBuffer: ArrayBuffer;
        
        if (parsed.isEncrypted) {
          if (decryptedCache[file.id]) {
            arrayBuffer = decryptedCache[file.id].arrayBuffer;
          } else {
            const res = await fetch(file.url);
            arrayBuffer = await res.arrayBuffer();
          }
        } else {
          const res = await fetch(file.url);
          arrayBuffer = await res.arrayBuffer();
        }
        
        zip.file(parsed.originalName + (parsed.isEncrypted && !decryptedCache[file.id] ? '.enc' : ''), arrayBuffer);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      triggerDownload(content, `secureshare_bulk_${Date.now()}.zip`);
      toast.success("Zipped and downloaded successfully!", { id: 'bulk-download' });
      setSelectedFileIds([]);
    } catch (err: any) {
      console.error(err);
      toast.error("Zipping failed: " + err.message, { id: 'bulk-download' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFileIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedFileIds.length} assets?`)) return;
    
    try {
      setIsDeleting(true);
      toast.loading("Erasure in progress...", { id: 'bulk-delete' });
      const filesToDelete = files.filter(f => selectedFileIds.includes(f.id));
      const names = filesToDelete.map(f => f.name);
      
      const { error } = await supabase.storage.from('secure-shares').remove(names);
      if (error) throw error;
      
      toast.success(`${selectedFileIds.length} assets permanently deleted.`, { id: 'bulk-delete' });
      setSelectedFileIds([]);
      onFileUpdate();
    } catch (err: any) {
      toast.error("Bulk delete failed: " + err.message, { id: 'bulk-delete' });
    } finally {
      setIsDeleting(false);
      toast.dismiss('bulk-delete');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-slate-500 text-sm font-mono tracking-widest uppercase animate-pulse">Decrypting Vault...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium text-slate-400">Vault is empty</p>
        <p className="text-sm mt-1">No files match your criteria.</p>
      </div>
    );
  }

  return (
    <>
      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col space-y-3"}>
        {files.map((file) => {
          const parsed = parseFileName(file.name);
          const isSelected = selectedFileIds.includes(file.id);
          
          return (
            <div 
              key={file.id} 
              className={`group bg-slate-950 border hover:shadow-[0_0_20px_var(--color-accent-glow)] rounded-xl overflow-hidden transition-all duration-300 ${
                isSelected ? 'border-accent' : 'border-slate-800 hover:border-slate-600'
              } ${viewMode === 'grid' ? 'flex flex-col' : 'flex flex-row items-center h-24'}`}
            >
              {/* File Preview Area */}
              <div 
                className={`${viewMode === 'grid' ? 'h-48 w-full' : 'h-full w-32 flex-shrink-0'} bg-slate-900/50 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-900 transition-colors cursor-pointer border-r border-transparent ${viewMode === 'list' && 'border-slate-800'}`}
                onClick={() => handleFileAction(file, file.type === 'zip' ? 'zip' : 'view')}
              >
                {/* Checkbox Overlay */}
                <div 
                  className={`absolute top-3 left-3 z-10 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'bg-accent border-accent text-white' 
                      : 'bg-slate-950/80 border-slate-700 opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={(e) => toggleSelectFile(file.id, e)}
                >
                  {isSelected && <div className="w-2 h-2 bg-white rounded-sm"></div>}
                </div>

                {/* Encrypted / Decrypted Visuals */}
                {parsed.isEncrypted && !decryptedCache[file.id] ? (
                  <div className="flex flex-col items-center text-slate-500">
                    <Key className="w-12 h-12 mb-1 animate-pulse" />
                    {viewMode === 'grid' && <span className="font-mono text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-semibold uppercase tracking-wider">PASSWORD REQUIRED</span>}
                  </div>
                ) : file.type === 'image' ? (
                  <>
                    <img 
                      src={decryptedCache[file.id]?.blobUrl || file.url} 
                      alt={parsed.originalName}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </>
                ) : file.type === 'zip' ? (
                  <div className="flex flex-col items-center text-amber-500/80">
                    <Archive className={viewMode === 'grid' ? "w-16 h-16 animate-pulse" : "w-8 h-8"} />
                    {viewMode === 'grid' && <span className="mt-2 font-mono text-xs text-amber-500/60 font-semibold tracking-wider">ZIP ARCHIVE</span>}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-rose-500/80">
                    <FileText className={viewMode === 'grid' ? "w-16 h-16" : "w-8 h-8"} />
                    {viewMode === 'grid' && <span className="mt-2 font-mono text-xs text-rose-500/60 font-semibold tracking-wider">PDF DOCUMENT</span>}
                  </div>
                )}
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>

              {/* File Details */}
              <div className={`p-4 flex flex-col justify-between flex-grow ${viewMode === 'list' && 'py-2 flex-row items-center'}`}>
                <div className={`${viewMode === 'list' ? 'flex-1 min-w-0 pr-4' : 'mb-3'}`}>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold text-slate-200 truncate" title={parsed.originalName}>
                      {parsed.originalName}
                    </p>
                    <button 
                      onClick={() => { setFileToRename(file); setNewName(parsed.originalName); }} 
                      className="text-slate-500 hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {/* Fingerprint & Badges */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs text-slate-500 mt-1 font-mono">
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    <span>{formatBytes(file.size)}</span>
                    {parsed.isEncrypted && (
                      <span className="text-[10px] text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.2 rounded font-semibold flex items-center">
                        🔐 ENCRYPTED
                      </span>
                    )}
                    {parsed.sha256 && (
                      <button 
                        onClick={() => handleCopyText(parsed.sha256 || '', 'SHA-256 Hash')}
                        className="text-[10px] text-slate-500 hover:text-slate-300 bg-slate-900 px-1 py-0.2 rounded flex items-center border border-slate-800"
                        title="Copy SHA-256 integrity fingerprint"
                      >
                        <ShieldCheck className="w-3 h-3 mr-1 text-emerald-500" />
                        SHA-256: {parsed.sha256.substring(0, 8)}...
                      </button>
                    )}
                  </div>
                </div>
                
                <div className={`flex items-center space-x-2 ${viewMode === 'grid' ? 'justify-between pt-3 border-t border-slate-800/50' : 'flex-shrink-0'}`}>
                  {/* Share button */}
                  <button
                    onClick={() => handleFileAction(file, 'share')}
                    className="flex items-center justify-center space-x-1.5 flex-1 bg-slate-800/50 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 px-3 rounded-lg transition-colors border border-slate-800"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {viewMode === 'grid' && <span>Share</span>}
                  </button>
                  
                  {/* Download Button */}
                  <button 
                    onClick={() => handleFileAction(file, 'download')}
                    className="flex items-center justify-center bg-accent/10 hover:bg-accent/20 text-accent text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-accent/20"
                    title="Decrypt & Download File"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setFileToDelete(file)}
                    className="flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-rose-500/20"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Preview Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={selectedImage} 
            alt="Fullscreen preview" 
            className="max-w-full max-h-full rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain border border-slate-800 transition-transform transform hover:scale-[1.01] duration-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-4 max-w-5xl mx-auto w-full">
            <div>
              <h3 className="text-lg font-bold text-slate-200">{selectedPdf.name}</h3>
              <p className="text-xs text-slate-500 font-mono tracking-wider">🔒 SECURE CLOUD PDF PREVIEW</p>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={async () => {
                  const res = await fetch(selectedPdf.url);
                  const blob = await res.blob();
                  triggerDownload(blob, selectedPdf.name);
                }}
                className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button 
                className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800"
                onClick={() => {
                  URL.revokeObjectURL(selectedPdf.url);
                  setSelectedPdf(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 max-w-5xl mx-auto w-full h-full bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-2xl">
            <iframe 
              src={selectedPdf.url} 
              className="w-full h-full border-none"
              title="PDF Reader"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* ZIP Archive Explorer Modal */}
      {zipContents && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-200 flex items-center">
                  <Archive className="w-5 h-5 mr-2 text-amber-500" />
                  ZIP Vault Explorer
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {parseFileName(zipContents.file.name).originalName} ({formatBytes(zipContents.file.size)})
                </p>
              </div>
              <button 
                onClick={() => setZipContents(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-2.5">
              {zipContents.files.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No files found inside the archive.</p>
              ) : (
                zipContents.files.map((innerFile, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-950/90 ${
                      innerFile.isDir ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {innerFile.isDir ? (
                        <Archive className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      ) : innerFile.path.toLowerCase().endsWith('.pdf') ? (
                        <FileText className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                      <span className="text-sm text-slate-200 font-mono truncate" title={innerFile.path}>
                        {innerFile.path}
                      </span>
                    </div>
                    
                    {!innerFile.isDir && (
                      <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                        <span className="text-xs text-slate-500 font-mono">{formatBytes(innerFile.size)}</span>
                        <button 
                          onClick={() => handleExtractZipFile(innerFile.fileEntry, innerFile.path)}
                          className="p-1.5 text-slate-400 hover:text-accent bg-slate-800 hover:bg-accent/10 rounded-lg transition-colors border border-slate-700/50"
                          title="Extract and Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 text-center">
              <button 
                onClick={() => handleFileAction(zipContents.file, 'download')}
                className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold py-2 px-5 rounded-lg inline-flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Complete ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / QR Code Modal */}
      {shareFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-200 flex items-center">
                <QrCode className="w-5 h-5 mr-2 text-accent" />
                Secure Sharing Options
              </h3>
              <button onClick={() => setShareFile(null)} className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Type Switcher */}
              <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-lg">
                <button
                  onClick={() => setShareLinkType('app')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    shareLinkType === 'app' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  App Web Viewer (Safe)
                </button>
                <button
                  onClick={() => setShareLinkType('direct')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    shareLinkType === 'direct' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Raw Storage Link
                </button>
              </div>

              {/* QR Code Canvas */}
              <div className="flex justify-center bg-white p-4 rounded-xl max-w-[190px] mx-auto border border-slate-200 shadow-inner">
                <canvas ref={qrCanvasRef}></canvas>
              </div>

              {/* Copy link input */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Share Link</label>
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden p-1.5">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-xs text-slate-300 font-mono px-2 outline-none select-all"
                  />
                  <button
                    onClick={() => handleCopyText(shareUrl, 'Share link')}
                    className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 text-center font-medium leading-normal mt-1">
                  {shareLinkType === 'app' 
                    ? "🔒 App link lets recipients view thumbnails, inspect hash integrity, and decrypt client-side."
                    : "⚠️ Raw links directly pull the encrypted ciphertext file. It will fail to view unless decrypted."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decryption Passphrase Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleDecryptSubmit}
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center space-x-3 text-accent">
              <div className="bg-accent/15 p-2.5 rounded-full border border-accent/25">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Decrypt Asset</h3>
                <p className="text-[10px] text-slate-500 font-mono">CLIENT-SIDE CRYPTOGRAPHIC SIGNATURE REQUIRED</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-400">
              The file <span className="text-slate-200 font-semibold font-mono">"{parseFileName(pendingAction.file.name).originalName}"</span> is AES-256 encrypted. Please input the passphrase to decrypt it in memory.
            </p>

            <div className="space-y-1">
              <input 
                type="password" 
                placeholder="Enter passphrase..."
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-sm font-mono"
                required
                autoFocus
              />
              {decryptError && (
                <p className="text-[10px] text-red-400 font-medium">⚠️ {decryptError}</p>
              )}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isDecrypting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-semibold transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDecrypting || !decryptPassword}
                className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isDecrypting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Decrypting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Decrypt
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {fileToRename && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-200 mb-2 flex items-center">
              <Edit2 className="w-5 h-5 mr-2 text-accent" />
              Rename Secure File
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
              Updating the catalog pointer. The original file content and cryptographic hash signature will remain identical.
            </p>
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-3 mb-6 focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-sm"
              autoFocus
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setFileToRename(null)}
                disabled={isRenaming}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-semibold transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={isRenaming || !newName.trim() || newName === parseFileName(fileToRename.name).originalName}
                className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isRenaming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-4">
              <div className="bg-rose-500/10 p-2.5 rounded-full border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">Permanently Erase?</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to permanently delete <span className="text-slate-200 font-semibold font-mono">"{parseFileName(fileToDelete.name).originalName}"</span>? This will wipe the encrypted blocks.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-semibold transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Operations Panel */}
      {selectedFileIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/95 border border-accent/30 backdrop-blur-md px-6 py-4 rounded-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 w-[calc(100%-2rem)] max-w-xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-slate-100 flex items-center justify-center sm:justify-start">
              <span className="w-2 h-2 rounded-full bg-accent mr-2 animate-ping"></span>
              {selectedFileIds.length} Assets Selected
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">BULK CRYPTO MATRIX ACTIVE</p>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-center">
            <button 
              onClick={handleBulkDownload}
              className="flex items-center space-x-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold px-4 py-2.5 rounded-lg border border-accent/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Zip & Download</span>
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg border border-rose-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Erase Selected</span>
            </button>
            <button 
              onClick={() => setSelectedFileIds([])}
              className="p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              title="Clear Selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
