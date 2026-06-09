import { useState, useEffect } from 'react';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { supabase } from './lib/supabase';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export type SharedFile = {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'image';
  created_at: string;
};

function App() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
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
            
            return {
              id: file.id || file.name,
              name: file.name,
              url: publicUrlData.publicUrl,
              type: isPdf ? 'pdf' : 'image',
              created_at: file.created_at || new Date().toISOString(),
            };
          })
        );
        
        // Sort by newest
        setFiles(parsedFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to load files from secure storage.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchFiles();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-900 selection:text-blue-100 font-sans p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">SecureShare</h1>
              <p className="text-sm text-slate-500 font-medium">Government-grade encrypted transfer</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 text-xs font-semibold tracking-wide">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>SYSTEM SECURE</span>
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
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-200">Encrypted Vault</h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {files.length} ASSETS SECURED
                </span>
              </div>
              
              <div className="p-6">
                {error ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 flex items-center space-x-3">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                ) : (
                  <FileList files={files} loading={loading} />
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
