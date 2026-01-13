
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
      const amt = Number(t.amount);
      
      // Totals for the cards
      if (t.direction === TransactionDirection.RECEIVED) {
        acc.received += amt;
      } else {
        acc.spent += amt;
        // Breakdown only for spending
        if (t.type === CategoryType.PERSONAL) acc.personalSpending += amt;
        else acc.officeSpending += amt;
      }
      
      return acc;
    }, { personalSpending: 0, officeSpending: 0, received: 0, spent: 0 });
  }, [filteredTransactions]);

  const pieData = [
    { name: 'Personal Expense', value: stats.personalSpending, color: '#6366F1' },
    { name: 'Office Expense', value: stats.officeSpending, color: '#10B981' }
  ];

  const tagData = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc: any, t) => {
      if (t.direction === TransactionDirection.RECEIVED) return acc;
      const tag = t.tag || 'Uncategorized';
      if (!acc[tag]) acc[tag] = 0;
      acc[tag] += Number(t.amount);
      return acc;
    }, {});
    return Object.keys(grouped).map(key => ({ name: key, value: grouped[key] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const trendData = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc: any, t) => {
      const key = selectedMonth === 'All' ? t.date.substring(0, 7) : t.date;
      if (!acc[key]) acc[key] = { date: key, spent: 0, received: 0 };
      const amt = Number(t.amount);
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
          <p className="text-slate-500">Comprehensive breakdown of your synced transactions</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-slate-600">Period:</label>
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
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
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
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} cornerRadius={4} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`]} />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
          <i className="fas fa-tags mr-2 text-amber-500"></i>
          Spending by Category Tag
        </h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tagData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{fontSize: 12, fontWeight: 500}} />
              <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Total']} />
              <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
          ₹{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className={`p-3 rounded-xl ${colorMap[color] || 'bg-slate-50 text-slate-600'}`}>
        <i className={`fas ${icon} text-lg`}></i>
      </div>
    </div>
  );
};
