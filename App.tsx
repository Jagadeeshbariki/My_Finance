
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
      // Check if already installed
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('fintrack_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('fintrack_tags', JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    localStorage.setItem('fintrack_script_url', scriptUrl);
  }, [scriptUrl]);

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
    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF bank statement.');
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
          setTransactions(extracted.map(t => ({ ...t, status: 'pending' })));
        } catch (err: any) {
          setError(err.message || 'AI Extraction failed. Check your API key.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('File read failed: ' + err.message);
      setIsProcessing(false);
    }
  };

  const syncToSpreadsheet = async () => {
    const approvedTransactions = transactions.filter(t => t.status === 'approved');
    if (approvedTransactions.length === 0) {
      setError('Please select transactions using the checkboxes first.');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const payload = approvedTransactions.map(t => ({
        date: t.date,
        bankName: t.bankName,
        description: t.description,
        amount: Number(t.amount),
        direction: t.direction,
        type: t.type,
        tag: t.tag
      }));

      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });

      // Update history state
      const updatedHistory = [...history, ...approvedTransactions];
      setHistory(updatedHistory);
      
      // Remove synced items from current list
      setTransactions(prev => prev.filter(t => t.status !== 'approved'));
      
      setIsSyncing(false);
      alert(`Successfully synced ${approvedTransactions.length} items to your Sheet!`);
      
      if (transactions.length === approvedTransactions.length) {
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      setError('Sync failed. Please verify your Script URL and Deployment settings.');
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 transition-colors duration-500">
      {/* PWA Install Notification */}
      {showInstallBanner && (
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-[100] animate-in slide-in-from-top duration-500">
          <div className="flex items-center">
            <div className="bg-indigo-500 p-2 rounded-lg mr-3">
              <i className="fas fa-download text-white"></i>
            </div>
            <div>
              <p className="text-sm font-bold">Install FinTrack App</p>
              <p className="text-[10px] text-indigo-100">Access your finances directly from your home screen.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleInstallClick} 
              className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm"
            >
              Install Now
            </button>
            <button onClick={() => setShowInstallBanner(false)} className="text-indigo-200 hover:text-white p-2">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' ? (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* Sync Config Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center">
                  <i className="fas fa-link mr-2 text-indigo-500 group-hover:rotate-45 transition-transform"></i>
                  Sync Destination
                </h3>
                <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 bg-slate-50 rounded">AUTO-SAVE ENABLED</span>
              </div>
              <input 
                type="text" 
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="Google Apps Script URL..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono transition-all"
              />
            </div>

            {/* Upload Area */}
            <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
              
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 ring-8 ring-indigo-50/50">
                <i className="fas fa-file-invoice-dollar text-indigo-600 text-3xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Analyze Statement</h2>
              <p className="text-slate-500 text-sm mb-8 max-w-sm">Drop your PDF bank statement here. Gemini AI will automatically extract dates, amounts, and categories.</p>
              
              <label className="cursor-pointer bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl hover:shadow-indigo-200 active:scale-95 flex items-center">
                <i className="fas fa-upload mr-2"></i>
                Select Bank PDF
                <input type="file" accept=".pdf" className="sr-only" onChange={handleFileUpload} />
              </label>
              
              {isProcessing && (
                <div className="mt-8 flex flex-col items-center text-indigo-600 font-bold animate-pulse">
                  <i className="fas fa-brain text-3xl mb-3 fa-bounce"></i>
                  <span className="text-sm tracking-widest uppercase">AI is reading your statement...</span>
                </div>
              )}
              
              {error && (
                <div className="mt-8 p-4 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100 max-w-md flex items-center">
                  <i className="fas fa-exclamation-triangle mr-3 text-lg"></i>
                  <div className="text-left font-medium">{error}</div>
                </div>
              )}
            </div>

            {/* Table Area */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center space-x-6">
                    <button 
                      onClick={() => {
                        const allApproved = transactions.every(t => t.status === 'approved');
                        setTransactions(transactions.map(t => ({ ...t, status: allApproved ? 'pending' : 'approved' })));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      {transactions.every(t => t.status === 'approved') ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span className="text-xs text-slate-500 font-semibold">
                      {transactions.filter(t => t.status === 'approved').length} selected for sync
                    </span>
                  </div>
                  <button 
                    onClick={syncToSpreadsheet}
                    disabled={isSyncing || transactions.filter(t => t.status === 'approved').length === 0}
                    className={`px-8 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-all flex items-center ${
                      isSyncing || transactions.filter(t => t.status === 'approved').length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-1 shadow-emerald-200'
                    }`}
                  >
                    {isSyncing ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-cloud-upload-alt mr-2"></i>}
                    Approve & Save to Sheets
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/30 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-5 w-10 text-center">Sync</th>
                        <th className="px-4 py-5">Date</th>
                        <th className="px-4 py-5">Bank</th>
                        <th className="px-4 py-5">Description</th>
                        <th className="px-4 py-5">Amount</th>
                        <th className="px-4 py-5">Category</th>
                        <th className="px-4 py-5">Tag</th>
                        <th className="px-6 py-5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
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
