import React, { useState, useEffect, useCallback } from 'react';
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
  
  const [tags] = useState<string[]>(['Rent', 'Utilities', 'Software', 'Travel', 'Meals', 'Office Supplies', 'Salary', 'Investment']);

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    return localStorage.getItem('fintrack_script_url') || DEFAULT_SCRIPT_URL;
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to load history from Google Sheets (GET)
  const loadHistoryFromSheet = useCallback(async (forcedUrl?: string) => {
    const urlToUse = forcedUrl || scriptUrl;
    if (!urlToUse || urlToUse.trim() === '' || urlToUse === 'https://script.google.com/macros/s/.../exec') return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(urlToUse);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const formattedData: Transaction[] = data.map((item: any) => ({
            id: item.id || `hist-${Math.random().toString(36).substring(2, 9)}`,
            date: item.date,
            bankName: item.bankName,
            description: item.description,
            amount: Number(item.amount),
            direction: item.direction === 'Received' ? TransactionDirection.RECEIVED : TransactionDirection.SPENT,
            type: item.type === 'Office' ? CategoryType.OFFICE : CategoryType.PERSONAL,
            tag: item.tag || 'Uncategorized',
            status: 'approved'
          }));
          setHistory(formattedData);
          localStorage.setItem('fintrack_history', JSON.stringify(formattedData));
        }
      }
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [scriptUrl]);

  // Load history on mount
  useEffect(() => {
    loadHistoryFromSheet();
  }, [loadHistoryFromSheet]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (!isStandalone) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('fintrack_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('fintrack_script_url', scriptUrl);
  }, [scriptUrl]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setDeferredPrompt(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      setError("Please upload a valid PDF bank statement.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const extracted = await extractTransactionsFromPDF(base64);
          setTransactions(extracted);
          e.target.value = '';
        } catch (err: any) {
          setError(err.message || 'AI Extraction failed.');
        } finally { 
          setIsProcessing(false); 
        }
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('An unexpected error occurred during upload.');
      setIsProcessing(false);
    }
  };

  const syncToSpreadsheet = async () => {
    const approvedTransactions = transactions.filter(t => t.status === 'approved');
    if (approvedTransactions.length === 0) {
      alert("Please approve at least one transaction before syncing.");
      return;
    }

    setIsSyncing(true);
    setError(null);
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedTransactions),
      });
      
      const newHistory = [...history, ...approvedTransactions];
      setHistory(newHistory);
      setTransactions(prev => prev.filter(t => t.status !== 'approved'));
      
      alert('Sync request sent! The sheet will update in a few seconds.');
      setTimeout(() => loadHistoryFromSheet(), 3000);
    } catch (err) {
      setError('Sync failed. Check your Web App URL.');
    } finally { 
      setIsSyncing(false); 
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 transition-colors duration-500">
      {showInstallBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl z-[100] flex items-center justify-between animate-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-wallet text-white text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Install FinTrack</p>
              <p className="text-[10px] text-slate-500">Access offline from your home screen</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleInstallClick} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">Install</button>
            <button onClick={() => setShowInstallBanner(false)} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
          </div>
        </div>
      )}

      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' ? (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sync Configuration</label>
                {isLoadingHistory && <span className="text-[9px] text-indigo-600 animate-pulse font-bold">FETCHING...</span>}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="Paste your Google Web App URL here"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <button 
                  onClick={() => loadHistoryFromSheet()}
                  disabled={isLoadingHistory}
                  className="bg-white border border-slate-200 px-4 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                  title="Force Refresh"
                >
                  <i className={`fas fa-sync-alt ${isLoadingHistory ? 'fa-spin text-indigo-600' : ''}`}></i>
                </button>
              </div>
              <p className="mt-2 text-[9px] text-slate-400 px-1 italic">Note: On your mobile, you must paste the same URL you used on your computer.</p>
            </div>

            <div className={`bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all ${isProcessing ? 'py-20' : 'py-16'}`}>
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all ${isProcessing ? 'bg-indigo-600 animate-bounce' : 'bg-indigo-50'}`}>
                <i className={`fas ${isProcessing ? 'fa-sync-alt fa-spin text-white' : 'fa-cloud-upload-alt text-indigo-600'} text-3xl`}></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Scan Statement</h2>
              <p className="text-slate-500 text-sm mb-8 px-6 max-w-md">Secure AI extraction of your bank transactions directly from PDF.</p>
              
              <label className={`cursor-pointer px-10 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center ${isProcessing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-1'}`}>
                <i className="fas fa-file-pdf mr-2"></i> 
                {isProcessing ? 'AI is analyzing...' : 'Select PDF'}
                <input type="file" accept=".pdf" className="sr-only" onChange={handleFileUpload} disabled={isProcessing} />
              </label>

              {error && (
                <div className="mt-8 mx-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center space-x-3 animate-in fade-in zoom-in duration-300">
                  <i className="fas fa-exclamation-circle text-red-500"></i>
                  <p className="text-red-700 text-xs font-medium text-left">{error}</p>
                </div>
              )}
            </div>

            {transactions.length > 0 && (
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
                <div className="px-6 py-5 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                   <div className="flex flex-col">
                     <span className="text-lg font-bold text-slate-800">{transactions.length} Transactions</span>
                     <span className="text-xs text-indigo-600 font-semibold">{transactions.filter(t => t.status === 'approved').length} Ready to Sync</span>
                   </div>
                   <button 
                    onClick={syncToSpreadsheet} 
                    disabled={isSyncing || transactions.filter(t => t.status === 'approved').length === 0}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95"
                   >
                     {isSyncing ? <><i className="fas fa-spinner fa-spin mr-2"></i> Syncing...</> : 'Push to Cloud'}
                   </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/30 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-4 w-10 text-center">OK</th>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Bank</th>
                        <th className="px-4 py-4">Desc</th>
                        <th className="px-4 py-4">Amount</th>
                        <th className="px-4 py-4">Type</th>
                        <th className="px-4 py-4">Tag</th>
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
          <div className="relative">
            <Dashboard transactions={history} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;