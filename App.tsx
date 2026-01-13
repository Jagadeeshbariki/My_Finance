
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TransactionRow } from './components/TransactionRow';
import { Dashboard } from './components/Dashboard';
import { Transaction, CategoryType, TransactionDirection } from './types';
import { extractTransactionsFromPDF } from './services/geminiService';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyd_fl5wRPoBviIxp_xzMuzyjkEwe_Xmgy8Mwb8p1SC350yNoyhBHw1zqEzDRcfFtP2/exec';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'dashboard'>('upload');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  const [history, setHistory] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fintrack_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [tags, setTags] = useState<string[]>(() => {
    const saved = localStorage.getItem('fintrack_tags');
    return saved ? JSON.parse(saved) : ['Rent', 'Utilities', 'Software', 'Travel', 'Meals', 'Office Supplies'];
  });

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    return localStorage.getItem('fintrack_script_url') || DEFAULT_SCRIPT_URL;
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt if not already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('fintrack_history', JSON.stringify(history));
  }, [history]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const extracted = await extractTransactionsFromPDF(base64);
          setTransactions(extracted.map(t => ({ ...t, status: 'pending' })));
        } catch (err: any) {
          setError(err.message || 'AI Extraction failed.');
        } finally { setIsProcessing(false); }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('File read failed.');
      setIsProcessing(false);
    }
  };

  const syncToSpreadsheet = async () => {
    const approvedTransactions = transactions.filter(t => t.status === 'approved');
    if (approvedTransactions.length === 0) return;
    setIsSyncing(true);
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(approvedTransactions),
      });
      setHistory([...history, ...approvedTransactions]);
      setTransactions(prev => prev.filter(t => t.status !== 'approved'));
      alert('Synced successfully!');
    } catch (err) {
      setError('Sync failed. Check your Apps Script URL.');
    } finally { setIsSyncing(false); }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 transition-colors duration-500">
      {/* Fixed Bottom PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl z-[100] flex items-center justify-between animate-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <i className="fas fa-wallet text-white text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Install FinTrack</p>
              <p className="text-[10px] text-slate-500">Fast, offline-ready & convenient</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleInstallClick} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all">Install</button>
            <button onClick={() => setShowInstallBanner(false)} className="text-slate-400 p-2 hover:text-slate-600"><i className="fas fa-times"></i></button>
          </div>
        </div>
      )}

      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' ? (
          <div className="space-y-8 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <input 
                type="text" 
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="Google Apps Script URL..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs font-mono"
              />
            </div>

            <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                <i className="fas fa-cloud-upload-alt text-indigo-600 text-3xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Bank Statement AI</h2>
              <p className="text-slate-500 text-sm mb-8">Upload your PDF for instant categorization.</p>
              <label className="cursor-pointer bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl flex items-center">
                <i className="fas fa-file-pdf mr-2"></i> Choose PDF File
                <input type="file" accept=".pdf" className="sr-only" onChange={handleFileUpload} />
              </label>
              {isProcessing && <div className="mt-8 text-indigo-600 font-bold animate-pulse">AI is extracting data...</div>}
              {error && <div className="mt-8 text-red-500 text-sm font-medium">{error}</div>}
            </div>

            {transactions.length > 0 && (
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 bg-slate-50 flex justify-between items-center">
                   <span className="text-xs text-slate-500 font-semibold">{transactions.filter(t => t.status === 'approved').length} Ready to Sync</span>
                   <button 
                    onClick={syncToSpreadsheet} 
                    disabled={isSyncing}
                    className="bg-emerald-600 text-white px-8 py-2.5 rounded-2xl text-sm font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50"
                   >
                     {isSyncing ? 'Syncing...' : 'Approve & Sync'}
                   </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-4 w-10"></th>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Bank</th>
                        <th className="px-4 py-4">Description</th>
                        <th className="px-4 py-4">Amount</th>
                        <th className="px-4 py-4">Type</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {transactions.map(t => (
                        <TransactionRow 
                          key={t.id} 
                          transaction={t} 
                          tags={tags}
                          onUpdate={(id, updates) => setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))}
                          onDelete={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Dashboard transactions={history} />
        )}
      </main>
    </div>
  );
};

export default App;
