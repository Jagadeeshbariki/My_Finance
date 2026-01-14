import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Transaction, CategoryType, TransactionDirection } from '../types';

interface DashboardProps {
  transactions: Transaction[];
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedBank, setSelectedBank] = useState<string>('All');

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map(t => t.date.substring(0, 7)));
    return ['All', ...Array.from(months).sort().reverse()];
  }, [transactions]);

  const availableBanks = useMemo(() => {
    const banks = new Set(transactions.map(t => t.bankName));
    return ['All', ...Array.from(banks).sort()];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const monthMatch = selectedMonth === 'All' || t.date.startsWith(selectedMonth);
      const bankMatch = selectedBank === 'All' || t.bankName === selectedBank;
      return monthMatch && bankMatch;
    });
  }, [transactions, selectedMonth, selectedBank]);

  const stats = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amt = Number(t.amount) || 0;
      if (t.direction === TransactionDirection.RECEIVED) {
        acc.received += amt;
      } else {
        acc.spent += amt;
        if (t.type === CategoryType.PERSONAL) acc.personalSpending += amt;
        else acc.officeSpending += amt;
      }
      return acc;
    }, { personalSpending: 0, officeSpending: 0, received: 0, spent: 0 });
  }, [filteredTransactions]);

  const bankData = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc: any, t) => {
      const bank = t.bankName || 'Unknown';
      if (!acc[bank]) acc[bank] = { name: bank, spent: 0, received: 0 };
      const amt = Number(t.amount) || 0;
      if (t.direction === TransactionDirection.RECEIVED) acc[bank].received += amt;
      else acc[bank].spent += amt;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => b.spent - a.spent);
  }, [filteredTransactions]);

  const pieData = [
    { name: 'Personal', value: stats.personalSpending, color: '#6366F1' },
    { name: 'Office', value: stats.officeSpending, color: '#10B981' }
  ].filter(d => d.value > 0);

  const tagData = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc: any, t) => {
      if (t.direction === TransactionDirection.RECEIVED) return acc;
      const tag = t.tag || 'Uncategorized';
      if (!acc[tag]) acc[tag] = 0;
      acc[tag] += Number(t.amount) || 0;
      return acc;
    }, {});
    return Object.keys(grouped).map(key => ({ name: key, value: grouped[key] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const trendData = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc: any, t) => {
      const key = selectedMonth === 'All' ? t.date.substring(0, 7) : t.date;
      if (!acc[key]) acc[key] = { date: key, spent: 0, received: 0 };
      const amt = Number(t.amount) || 0;
      if (t.direction === TransactionDirection.RECEIVED) acc[key].received += amt;
      else acc[key].spent += amt;
      return acc;
    }, {});
    return Object.keys(grouped).sort().map(key => grouped[key]);
  }, [filteredTransactions, selectedMonth]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Analytics</h2>
          <p className="text-slate-500 text-xs">Bank and Monthly Insights</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
          >
            {availableMonths.map(m => <option key={m} value={m}>{m === 'All' ? 'All Months' : m}</option>)}
          </select>
          <select 
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
          >
            {availableBanks.map(b => <option key={b} value={b}>{b === 'All' ? 'All Banks' : b}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spent" value={stats.spent} icon="fa-arrow-down" color="orange" />
        <StatCard title="Total Received" value={stats.received} icon="fa-arrow-up" color="purple" />
        <StatCard title="Personal Expense" value={stats.personalSpending} icon="fa-user" color="blue" />
        <StatCard title="Office Expense" value={stats.officeSpending} icon="fa-briefcase" color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Cash Flow Trend</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9}} />
                <Tooltip />
                <Area type="monotone" dataKey="spent" stroke="#F97316" fill="#F97316" fillOpacity={0.05} strokeWidth={2} />
                <Area type="monotone" dataKey="received" stroke="#A855F7" fill="#A855F7" fillOpacity={0.05} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Bank Wise Distribution</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bankData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{fontSize: 9}} />
                <Tooltip />
                <Bar dataKey="spent" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Spending by Tag</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tagData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                <Tooltip />
                <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Category Mix</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: number, icon: string, color: string }) => {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600'
  };
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">{title}</p>
        <p className="text-lg font-bold text-slate-900 mt-1">₹{value.toLocaleString()}</p>
      </div>
      <div className={`p-3 rounded-xl ${colorMap[color]}`}><i className={`fas ${icon}`}></i></div>
    </div>
  );
};