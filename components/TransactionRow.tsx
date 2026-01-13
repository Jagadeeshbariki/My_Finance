
import React from 'react';
import { Transaction, CategoryType, TransactionDirection } from '../types';

interface TransactionRowProps {
  transaction: Transaction;
  tags: string[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, tags, onUpdate, onDelete }) => {
  const isApproved = transaction.status === 'approved';

  return (
    <tr className={`transition-colors border-b border-slate-100 last:border-0 ${isApproved ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`}>
      <td className="px-4 py-4 text-center">
        <button
          onClick={() => onUpdate(transaction.id, { status: isApproved ? 'pending' : 'approved' })}
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${
            isApproved 
            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
            : 'bg-white border-slate-200 text-transparent hover:border-indigo-400'
          }`}
        >
          <i className="fas fa-check text-[10px]"></i>
        </button>
      </td>
      <td className={`px-4 py-4 whitespace-nowrap text-sm tabular-nums ${isApproved ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
        {transaction.date}
      </td>
      <td className="px-4 py-4">
        <input
          type="text"
          value={transaction.bankName}
          onChange={(e) => onUpdate(transaction.id, { bankName: e.target.value })}
          className="bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none text-sm font-medium text-slate-600 w-full"
        />
      </td>
      <td className="px-4 py-4">
        <input
          type="text"
          value={transaction.description}
          onChange={(e) => onUpdate(transaction.id, { description: e.target.value })}
          className="bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none text-sm font-medium text-slate-700 w-full truncate"
        />
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 font-bold tabular-nums">
        <div className="flex flex-col">
          <span>₹{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className={`text-[9px] font-bold uppercase tracking-tight ${transaction.direction === TransactionDirection.RECEIVED ? 'text-purple-500' : 'text-orange-500'}`}>
            {transaction.direction}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <select
          value={transaction.type}
          onChange={(e) => onUpdate(transaction.id, { type: e.target.value as CategoryType })}
          className={`text-xs font-bold px-2 py-1 rounded-md border-0 ring-1 ring-inset focus:ring-2 focus:ring-indigo-500 ${
            transaction.type === CategoryType.PERSONAL 
            ? 'bg-blue-50 text-blue-700 ring-blue-600/20' 
            : 'bg-slate-50 text-slate-700 ring-slate-600/20'
          }`}
        >
          <option value={CategoryType.PERSONAL}>Personal</option>
          <option value={CategoryType.OFFICE}>Office</option>
        </select>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <select
          value={transaction.tag}
          onChange={(e) => onUpdate(transaction.id, { tag: e.target.value })}
          className="text-xs font-medium text-slate-600 bg-white border-0 ring-1 ring-inset ring-slate-200 rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="Uncategorized">Select Tag...</option>
          {tags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
        <button 
          onClick={() => onDelete(transaction.id)}
          className="text-slate-300 hover:text-red-500 transition-colors p-1"
          title="Remove entry"
        >
          <i className="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  );
};
