import type { SharedFile } from '../App';
import { FileText, Download, Loader2 } from 'lucide-react';

interface FileListProps {
  files: SharedFile[];
  loading: boolean;
}

export function FileList({ files, loading }: FileListProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {files.map((file) => (
        <div 
          key={file.id} 
          className="group bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all duration-200"
        >
          {/* File Preview Area */}
          <div className="h-40 bg-slate-900/50 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-900 transition-colors">
            {file.type === 'image' ? (
              <img 
                src={file.url} 
                alt={file.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
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
          <div className="p-4 flex items-center justify-between">
            <div className="overflow-hidden pr-4">
              <p className="text-sm font-medium text-slate-200 truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {new Date(file.created_at).toLocaleDateString()} {new Date(file.created_at).toLocaleTimeString()}
              </p>
            </div>
            
            <a 
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="View / Download"
              download
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
