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
  const [showSettings, setShowSettings] = useState(false);
  
  // Custom Lists Management
  const [tags, setTags] = useState<string[]>(() => {
    const saved = localStorage.getItem('fintrack_tags');
    return saved ? JSON.parse(saved) : ['Rent', 'Food', 'Electicity', 'reacharge', 'EMI', 'office_mess', 'Petrol', 'Home', 'Salary', 'Travel'];
  });

  const [banks, setBanks] = useState<string[]>(() => {
    const saved = localStorage.getItem('fintrack_banks');
    return saved ? JSON.parse(saved) : ['Primary Bank', 'Credit Card'];
  });

  const [history, setHistory] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fintrack_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    return localStorage.getItem('fintrack_script_url') || DEFAULT_SCRIPT_URL;
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persistence (Local)
  useEffect(() => { localStorage.setItem('fintrack_tags', JSON.stringify(tags)); }, [tags]);
  useEffect(() => { localStorage.setItem('fintrack_banks', JSON.stringify(banks)); }, [banks]);
  useEffect(() => { localStorage.setItem('fintrack_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('fintrack_script_url', scriptUrl); }, [scriptUrl]);

  const loadDataFromSheet = useCallback(async (forcedUrl?: string) => {
    const urlToUse = forcedUrl || scriptUrl;
    if (!urlToUse || urlToUse.trim() === '' || urlToUse === DEFAULT_SCRIPT_URL) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(urlToUse);
      if (response.ok) {
        const result = await response.json();
        
        // Handle combined response
        if (result.transactions && Array.isArray(result.transactions)) {
          const formattedData: Transaction[] = result.transactions.map((item: any) => ({
            id: `hist-${Math.random().toString(36).substring(2, 9)}`,
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
        }

        // Load synced config (tags/banks)
        if (result.config) {
          if (result.config.tags && result.config.tags.length > 0) setTags(result.config.tags);
          if (result.config.banks && result.config.banks.length > 0) setBanks(result.config.banks);
        }
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [scriptUrl]);

  useEffect(() => {
    loadDataFromSheet();
  }, [loadDataFromSheet]);

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
          
          const updatedExtracted = extracted.map(t => {
            // Intelligent bank matching
            let matchedBank = banks[0] || t.bankName;
            const found = banks.find(b => t.bankName.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(t.bankName.toLowerCase()));
            if (found) matchedBank = found;

            return {
              ...t,
              bankName: matchedBank,
              status: 'approved' as const
            };
          });
          setTransactions(updatedExtracted);
        } catch (err: any) {
          setError(err.message || 'AI Extraction failed.');
        } finally { setIsProcessing(false); }
      };
      reader.readAsDataURL(file);
    } catch (err) { setIsProcessing(false); }
  };

  const syncToSpreadsheet = async () => {
    if (transactions.length === 0) return;
    setIsSyncing(true);
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactions),
      });
      setHistory(prev => [...prev, ...transactions]);
      setTransactions([]);
      alert('Transactions synced!');
      setTimeout(() => loadDataFromSheet(), 2000);
    } catch (err) {
      setError('Sync failed.');
    } finally { setIsSyncing(false); }
  };

  const saveConfigToCloud = async () => {
    if (!scriptUrl || scriptUrl === DEFAULT_SCRIPT_URL) {
      alert("Please set your Google App Script URL first.");
      return;
    }
    setIsSavingConfig(true);
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isConfigUpdate: true,
          tags: tags,
          banks: banks
        }),
      });
      alert('Dropdown options saved to cloud!');
    } catch (err) {
      alert('Failed to save configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const addNewItem = (list: 'tags' | 'banks', value: string) => {
    if (!value.trim()) return;
    if (list === 'tags') setTags(prev => [...new Set([...prev, value.trim()])]);
    else setBanks(prev => [...new Set([...prev, value.trim()])]);
  };

  const removeItem = (list: 'tags' | 'banks', value: string) => {
    if (list === 'tags') setTags(prev => prev.filter(t => t !== value));
    else setBanks(prev => prev.filter(b => b !== value));
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' ? (
          <div className="space-y-8 max-w-5xl mx-auto">
            {/* Sync & Settings Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Spreadsheet Cloud Link</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="https://script.google.com/macros/s/..."
                  />
                  <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-xl border transition-all ${showSettings ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                    <i className="fas fa-cog"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Settings Management Panel */}
            {showSettings && (
              <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                      <i className="fas fa-tags mr-2 text-indigo-500"></i> Manage Tags
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4 max-h-40 overflow-y-auto p-1">
                      {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold">
                          {tag}
                          <button onClick={() => removeItem('tags', tag)} className="ml-2 hover:text-red-500"><i className="fas fa-times"></i></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input id="new-tag" type="text" placeholder="Add tag..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" onKeyDown={(e) => e.key === 'Enter' && (addNewItem('tags', (e.target as any).value), (e.target as any).value = '')} />
                      <button onClick={() => { const el = document.getElementById('new-tag') as HTMLInputElement; addNewItem('tags', el.value); el.value = ''; }} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Add</button>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                      <i className="fas fa-university mr-2 text-emerald-500"></i> My Banks
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4 max-h-40 overflow-y-auto p-1">
                      {banks.map(bank => (
                        <span key={bank} className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold">
                          {bank}
                          <button onClick={() => removeItem('banks', bank)} className="ml-2 hover:text-red-500"><i className="fas fa-times"></i></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input id="new-bank" type="text" placeholder="Add bank..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" onKeyDown={(e) => e.key === 'Enter' && (addNewItem('banks', (e.target as any).value), (e.target as any).value = '')} />
                      <button onClick={() => { const el = document.getElementById('new-bank') as HTMLInputElement; addNewItem('banks', el.value); el.value = ''; }} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Add</button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                   <button 
                    onClick={saveConfigToCloud}
                    disabled={isSavingConfig}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center space-x-2"
                   >
                     {isSavingConfig ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                     <span>Save Dropdown Options to Cloud</span>
                   </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all py-16">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all ${isProcessing ? 'bg-indigo-600 animate-bounce' : 'bg-indigo-50'}`}>
                <i className={`fas ${isProcessing ? 'fa-sync-alt fa-spin text-white' : 'fa-cloud-upload-alt text-indigo-600'} text-3xl`}></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Scan Statement</h2>
              <p className="text-slate-500 text-sm mb-8 px-6 max-w-md">Upload bank PDF. AI extracts data strictly into your defined bank names.</p>
              <label className={`cursor-pointer px-10 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center ${isProcessing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                <i className="fas fa-file-pdf mr-2"></i> {isProcessing ? 'AI is working...' : 'Select PDF'}
                <input type="file" accept=".pdf" className="sr-only" onChange={handleFileUpload} disabled={isProcessing} />
              </label>
              {error && <p className="mt-4 text-red-500 text-xs font-medium">{error}</p>}
            </div>

            {transactions.length > 0 && (
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10">
                <div className="px-6 py-5 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">{transactions.length} Transactions Found</h3>
                  <button onClick={syncToSpreadsheet} disabled={isSyncing} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-lg hover:bg-emerald-700 disabled:bg-slate-200 transition-all">
                    {isSyncing ? 'Syncing...' : 'Sync All to Spreadsheet'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/30 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-4 py-4">Bank</th>
                        <th className="px-4 py-4">Description</th>
                        <th className="px-4 py-4">Amount</th>
                        <th className="px-4 py-4">Type</th>
                        <th className="px-4 py-4">Tag</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {transactions.map(t => (
                        <TransactionRow 
                          key={t.id} 
                          transaction={t} 
                          tags={tags}
                          banks={banks}
                          onUpdate={(id, updates) => setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx))}
                          onDelete={(id) => setTransactions(prev => prev.filter(tx => tx.id !== id))}
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