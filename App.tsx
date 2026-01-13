
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
  const [newTagInput, setNewTagInput] = useState('');

  useEffect(() => {
    localStorage.setItem('fintrack_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('fintrack_tags', JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    localStorage.setItem('fintrack_script_url', scriptUrl);
  }, [scriptUrl]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
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
          setError(err.message);
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

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const toggleAllApproval = () => {
    const allApproved = transactions.every(t => t.status === 'approved');
    setTransactions(prev => prev.map(t => ({ ...t, status: allApproved ? 'pending' : 'approved' })));
  };

  const syncToSpreadsheet = async () => {
    const approvedTransactions = transactions.filter(t => t.status === 'approved');
    
    if (approvedTransactions.length === 0) {
      setError('Please select/approve transactions first using the checkboxes.');
      return;
    }

    if (!scriptUrl || !scriptUrl.startsWith('https://script.google.com')) {
      setError('Invalid Google Script URL. Please check your configuration.');
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

      // In 'no-cors' mode, we won't see the response body, but the data will reach the server
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 
          'Content-Type': 'text/plain' 
        },
        body: JSON.stringify(payload),
      });

      // Transfer to history and clear from pending
      const updatedHistory = [...history, ...approvedTransactions];
      setHistory(updatedHistory);
      setTransactions(prev => prev.filter(t => t.status !== 'approved'));
      
      setIsSyncing(false);
      alert(`Sent ${approvedTransactions.length} transactions to Google Sheets.`);
      
      if (transactions.length === approvedTransactions.length) {
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      setError('Connection failed. Ensure your Script URL is correct and deployed as "Anyone".');
      setIsSyncing(false);
    }
  };

  const addTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput && !tags.includes(newTagInput)) {
      setTags(prev => [...prev, newTagInput]);
      setNewTagInput('');
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' ? (
          <div className="space-y-8 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center">
                  <i className="fas fa-link mr-2 text-indigo-500"></i>
                  Sync Configuration
                </h3>
                <button 
                  onClick={() => setScriptUrl(DEFAULT_SCRIPT_URL)}
                  className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase"
                >
                  Reset to Default
                </button>
              </div>
              <input 
                type="text" 
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="Google Script URL (ends in /exec)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-2 italic">
                Tip: Deployment access MUST be set to "Anyone". Check your Apps Script settings.
              </p>
            </div>

            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <i className="fas fa-file-invoice-dollar text-indigo-600 text-2xl"></i>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Upload Bank Statement</h2>
              <p className="text-slate-500 text-sm mb-6">PDF data is extracted locally using Gemini AI</p>
              
              <label className="cursor-pointer bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                <span>Choose PDF File</span>
                <input type="file" accept=".pdf" className="sr-only" onChange={handleFileUpload} />
              </label>
              
              {isProcessing && (
                <div className="mt-6 flex items-center space-x-2 text-indigo-600 font-bold animate-pulse">
                  <i className="fas fa-circle-notch fa-spin"></i>
                  <span>Gemini AI is processing...</span>
                </div>
              )}
              
              {error && (
                <div className="mt-6 p-3 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 max-w-md">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  {error}
                </div>
              )}
            </div>

            {transactions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={toggleAllApproval}
                      className="text-xs font-bold text-indigo-600 bg-indigo-100/50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      {transactions.every(t => t.status === 'approved') ? 'Unselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-slate-500 font-medium">
                      {transactions.filter(t => t.status === 'approved').length} selected for sync
                    </span>
                  </div>
                  <button 
                    onClick={syncToSpreadsheet}
                    disabled={isSyncing || transactions.filter(t => t.status === 'approved').length === 0}
                    className={`px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center ${
                      isSyncing || transactions.filter(t => t.status === 'approved').length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-0.5 shadow-emerald-100'
                    }`}
                  >
                    {isSyncing ? <i className="fas fa-sync fa-spin mr-2"></i> : <i className="fas fa-cloud-upload-alt mr-2"></i>}
                    Approve & Sync to Sheet
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-4 w-10 text-center">Sync</th>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Bank</th>
                        <th className="px-4 py-4">Description</th>
                        <th className="px-4 py-4">Amount</th>
                        <th className="px-4 py-4">Category</th>
                        <th className="px-4 py-4">Tag</th>
                        <th className="px-4 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {transactions.map(t => (
                        <TransactionRow 
                          key={t.id} 
                          transaction={t} 
                          tags={tags}
                          onUpdate={updateTransaction}
                          onDelete={deleteTransaction}
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
