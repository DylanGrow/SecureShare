import { useState } from 'react';
import { X, Key, Globe, Settings, Loader2, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

export type VTIntegrationMode = 'disabled' | 'function' | 'direct';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: VTIntegrationMode;
  setMode: (mode: VTIntegrationMode) => void;
  functionUrl: string;
  setFunctionUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  mode,
  setMode,
  functionUrl,
  setFunctionUrl,
  apiKey,
  setApiKey
}: SettingsModalProps) {
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    // Use EICAR malware test file SHA-256 hash
    const testHash = "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f";

    try {
      if (mode === 'function') {
        if (!functionUrl.trim()) throw new Error("Please enter the Edge Function URL.");
        const res = await fetch(`${functionUrl.trim()}?hash=${testHash}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with code ${res.status}`);
        }
        const data = await res.json();
        if (data.status === 'success' || data.status === 'not_found') {
          toast.success("Supabase Proxy Connection Successful!");
        } else {
          throw new Error("Invalid response schema.");
        }
      } else if (mode === 'direct') {
        if (!apiKey.trim()) throw new Error("Please enter your VirusTotal API key.");
        
        // Fetch via corsproxy.io to bypass browser CORS blocks
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(`https://www.virustotal.com/api/v3/files/${testHash}`)}&reqHeaders=${encodeURIComponent(`x-apikey:${apiKey.trim()}`)}`;
        const res = await fetch(proxyUrl);
        
        if (res.status === 401 || res.status === 403) {
          throw new Error("Invalid API key or unauthorized.");
        }
        
        toast.success("VirusTotal API Key Verified Successfully via proxy!");
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError && mode === 'direct') {
        toast.error("Connection failed: Blocked by CORS. You must run a CORS bypass proxy or use the Supabase Edge Function.");
      } else {
        toast.error(`Connection failed: ${err.message}`);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <h3 className="text-lg font-bold text-slate-200 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-accent" />
            System Integrations
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Box */}
        <p className="text-xs text-slate-400 leading-normal">
          Configure security checks for your uploaded shares. This computes the SHA-256 fingerprint of your files and cross-references them with VirusTotal's anti-malware databases.
        </p>

        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">VirusTotal Integration</label>
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['disabled', 'function', 'direct'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-2 text-[10px] sm:text-xs font-bold rounded-md capitalize transition-colors cursor-pointer ${
                  mode === m 
                    ? 'bg-accent text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'disabled' ? 'Off' : m === 'function' ? 'Edge Proxy' : 'Developer'}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional Form Inputs */}
        {mode === 'function' && (
          <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Edge Function Proxy URL</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
                <Globe className="w-4 h-4 text-slate-500 mx-2 flex-shrink-0" />
                <input 
                  type="url" 
                  placeholder="https://[project-ref].supabase.co/functions/v1/virustotal"
                  value={functionUrl}
                  onChange={(e) => setFunctionUrl(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-200 py-1.5 px-1 outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              🌐 **Production Recommended:** The serverless Edge Function proxies your requests safely. Put your VirusTotal API key inside your Supabase Secrets as `VIRUSTOTAL_API_KEY`.
            </p>
          </div>
        )}

        {mode === 'direct' && (
          <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VirusTotal API Key</label>
                <a 
                  href="https://www.virustotal.com/gui/join-us" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[10px] text-accent hover:underline"
                >
                  Get free key ↗
                </a>
              </div>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
                <Key className="w-4 h-4 text-slate-500 mx-2 flex-shrink-0" />
                <input 
                  type="password" 
                  placeholder="Paste VT API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-200 py-1.5 px-1 outline-none font-mono"
                />
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-400 text-[10px] flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                🚀 **Zero-Setup Proxy:** Direct Mode uses a built-in HTTPS proxy (`corsproxy.io`) in your browser to bypass CORS restrictions. No server setup or browser plugins are required! Your key is saved locally.
              </p>
            </div>
          </div>
        )}

        {/* Buttons */}
        {mode !== 'disabled' && (
          <div className="flex space-x-3 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-accent hover:bg-accent-hover text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Save Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Dummy shield icon for warning
function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
