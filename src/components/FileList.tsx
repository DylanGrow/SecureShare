import { useState } from 'react';
import type { SharedFile } from '../App';
import { FileText, Download, Loader2, Link as LinkIcon, Trash2, X, AlertTriangle, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface FileListProps {
  files: SharedFile[];
  loading: boolean;
  onFileUpdate: () => void;
}

export function FileList({ files, loading, onFileUpdate }: FileListProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<SharedFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy link.');
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
      toast.error(err.message || 'Failed to delete file. Ensure delete permissions are set.');
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 text-sm font-mono tracking-widest uppercase animate-pulse">Decrypting Vault...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium text-slate-400">Vault is empty</p>
        <p className="text-sm mt-1">No files have been secured yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map((file) => (
          <div 
            key={file.id} 
            className="group bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all duration-200 flex flex-col"
          >
            {/* File Preview Area */}
            <div 
              className="h-48 bg-slate-900/50 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-900 transition-colors cursor-pointer"
              onClick={() => file.type === 'image' ? setSelectedImage(file.url) : window.open(file.url, '_blank')}
            >
              {file.type === 'image' ? (
                <>
                  {!loadedImages[file.id] && (
                    <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                    </div>
                  )}
                  <img 
                    src={file.url} 
                    alt={file.name}
                    loading="lazy"
                    onLoad={() => setLoadedImages(prev => ({ ...prev, [file.id]: true }))}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages[file.id] ? 'opacity-100' : 'opacity-0'}`}
                  />
                </>
              ) : file.type === 'zip' ? (
                <div className="flex flex-col items-center text-amber-500/80">
                  <Archive className="w-16 h-16" />
                  <span className="mt-2 font-mono text-xs text-amber-500/60 font-semibold tracking-wider">ZIP ARCHIVE</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-rose-500/80">
                  <FileText className="w-16 h-16" />
                  <span className="mt-2 font-mono text-xs text-rose-500/60 font-semibold tracking-wider">PDF DOCUMENT</span>
                </div>
              )}
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>

            {/* File Details */}
            <div className="p-4 flex flex-col justify-between flex-grow">
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-200 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {new Date(file.created_at).toLocaleDateString()} {new Date(file.created_at).toLocaleTimeString()}
                </p>
              </div>
              
              <div className="flex items-center justify-between space-x-2 pt-3 border-t border-slate-800/50">
                <button
                  onClick={() => handleCopyLink(file.url)}
                  className="flex items-center justify-center space-x-1.5 flex-1 bg-slate-800/50 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 rounded-lg transition-colors"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
                <a 
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  title="Download"
                  download
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setFileToDelete(file)}
                  className="flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  title="Delete File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 text-slate-400 hover:text-white bg-slate-900/50 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={selectedImage} 
            alt="Fullscreen preview" 
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-4">
              <div className="bg-rose-500/10 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to permanently delete <span className="text-slate-200 font-medium">"{fileToDelete.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Dummy icon for skeleton
function ImageIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
