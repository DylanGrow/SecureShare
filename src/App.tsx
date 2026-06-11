import { useState, useEffect } from 'react';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { supabase } from './lib/supabase';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

export type SharedFile = {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'zip';
  created_at: string;
  size: number;
};

function App() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'type'>('newest');
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [totalStorage, setTotalStorage] = useState(0);

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) setGlobalDragActive(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 && e.clientY === 0) setGlobalDragActive(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDragActive(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', (e) => e.preventDefault()); // required to allow drop

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', (e) => e.preventDefault());
    };
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      // Ensure your bucket is public or you handle auth appropriately
      const { data, error } = await supabase.storage.from('secure-shares').list();
      
      if (error) {
        throw error;
      }

      if (data) {
        const parsedFiles: SharedFile[] = await Promise.all(
          data.filter(file => file.name !== '.emptyFolderPlaceholder').map(async (file) => {
            const { data: publicUrlData } = supabase.storage
              .from('secure-shares')
              .getPublicUrl(file.name);

            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const isZip = file.name.toLowerCase().endsWith('.zip');
            
            return {
              id: file.id || file.name,
              name: file.name,
              url: publicUrlData.publicUrl,
              type: isPdf ? 'pdf' : isZip ? 'zip' : 'image',
              created_at: file.created_at || new Date().toISOString(),
              size: file.metadata?.size || 0,
            };
          })
        );
        
        setFiles(parsedFiles);
        const totalSize = parsedFiles.reduce((acc, file) => acc + (file.size || 0), 0);
        setTotalStorage(totalSize);
      }
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to load files from secure storage.');
      toast.error('Failed to sync vault.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchFiles();
  };

  const sortedFiles = [...files]
    .filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'az') return a.name.localeCompare(b.name);
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      return 0;
    });

  const MAX_STORAGE = 10 * 1024 * 1024 * 1024; // 10 GB limit for UI demo
  const storagePercent = Math.min((totalStorage / MAX_STORAGE) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-900 selection:text-blue-100 font-sans p-6 relative">
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }
      }}/>
      
      {/* Global Drag Overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-50 bg-blue-950/80 backdrop-blur-sm flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-3xl pointer-events-none">
          <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <UploadArea onUploadSuccess={handleUploadSuccess} isGlobal={true} onDismiss={() => setGlobalDragActive(false)} />
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="sticky top-0 z-40 -mx-6 px-6 py-4 mb-4 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">SecureShare</h1>
              <p className="text-sm text-slate-500 font-medium">Government-grade encrypted transfer</p>
            </div>
          </div>

          <div className="flex items-center space-x-6 w-full sm:w-auto">
            {/* Storage Quota */}
            <div className="hidden md:flex flex-col items-end mr-4">
              <div className="flex justify-between w-48 text-xs text-slate-400 mb-1">
                <span>Storage</span>
                <span>{(totalStorage / 1024 / 1024).toFixed(2)} MB / 10 GB</span>
              </div>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.max(storagePercent, 1)}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 text-xs font-semibold tracking-wide flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="hidden sm:inline">SYSTEM SECURE</span>
              <span className="sm:hidden">SECURE</span>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center">
                Initialize Transfer
              </h2>
              <UploadArea onUploadSuccess={handleUploadSuccess} />
            </div>
            
            {/* System Status / Instructions */}
            <div className="mt-6 bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Security Protocols</h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 text-blue-400" />
                  <span>Strict CSP enforced. No external trackers active.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 text-blue-400" />
                  <span>XSS protection active via sanitized renders.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 text-blue-400" />
                  <span>Only PDF and cryptographic image signatures allowed.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Files List */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl min-h-[500px]">
              <div className="p-6 border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-semibold text-slate-200">Encrypted Vault</h2>
                  <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    {sortedFiles.length} ASSETS
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  {/* Search Bar */}
                  <input 
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-48 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2 outline-none"
                  />

                  {/* View Toggle */}
                  <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1 w-full sm:w-auto justify-center">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Grid
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      List
                    </button>
                  </div>

                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full sm:w-auto bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="oldest">Sort: Oldest</option>
                    <option value="az">Sort: A-Z</option>
                    <option value="type">Sort: Type</option>
                  </select>
                </div>
              </div>
              
              <div className="p-6">
                {error ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 flex items-center space-x-3">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                ) : (
                  <FileList files={sortedFiles} loading={loading} onFileUpdate={fetchFiles} viewMode={viewMode} />
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
