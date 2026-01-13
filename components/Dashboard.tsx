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

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map(t => t.date.substring(0, 7)));
    return ['All', ...Array.from(months).sort().reverse()];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'All') return transactions;
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const stats = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amt = Number(t.amount) || 0;
      
      if (t.direction === TransactionDirection.RECEIVED) {
        acc.received += amt;
      } else if (t.direction === TransactionDirection.SPENT) {
        acc.spent += amt;
        if (t.type === CategoryType.PERSONAL) acc.personalSpending += amt;
        else if (t.type === CategoryType.OFFICE) acc.officeSpending += amt;
      }
      
      return acc;
    }, { personalSpending: 0, officeSpending: 0, received: 0, spent: 0 });
  }, [filteredTransactions]);

  const pieData = [
    { name: 'Personal Exp.', value: stats.personalSpending, color: '#6366F1' },
    { name: 'Office Exp.', value: stats.officeSpending, color: '#10B981' }
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Insights</h2>
          <p className="text-slate-500 text-sm">Review your tracked spending and income</p>
        </div>
        <select 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        >
          {availableMonths.map(m => (
            <option key={m} value={m}>{m === 'All' ? 'Complete History' : m}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spent" value={stats.spent} icon="fa-arrow-down" color="orange" />
        <StatCard title="Total Received" value={stats.received} icon="fa-arrow-up" color="purple" />
        <StatCard title="Personal Expense" value={stats.personalSpending} icon="fa-user" color="blue" />
        <StatCard title="Office Expense" value={stats.officeSpending} icon="fa-briefcase" color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <i className="fas fa-chart-line mr-2 text-indigo-500"></i>
            Cash Flow Trend
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(val: number) => [`₹${val.toLocaleString()}`]}
                />
                <Area type="monotone" dataKey="spent" stroke="#F97316" fill="#F97316" fillOpacity={0.05} strokeWidth={2} name="Spent" />
                <Area type="monotone" dataKey="received" stroke="#A855F7" fill="#A855F7" fillOpacity={0.05} strokeWidth={2} name="Received" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <i className="fas fa-pie-chart mr-2 text-emerald-500"></i>
            Expense Mix
          </h3>
          <div className="h-[300px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={8} 
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`]} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No expense data available</div>
            )}
          </div>
        </div>
      </div>

      {tagData.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <i className="fas fa-tags mr-2 text-amber-500"></i>
            Spending by Tag
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tagData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 11}} />
                <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`]} />
                <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
          ₹{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className={`p-3 rounded-xl ${colorMap[color] || 'bg-slate-50'}`}>
        <i className={`fas ${icon} text-lg`}></i>
      </div>
    </div>
  );
};