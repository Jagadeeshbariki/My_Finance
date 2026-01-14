import React from 'react';
import { Transaction, CategoryType, TransactionDirection } from '../types';

interface TransactionRowProps {
  transaction: Transaction;
  tags: string[];
  banks: string[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, tags, banks, onUpdate, onDelete }) => {
  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 tabular-nums">
        {transaction.date}
      </td>
      <td className="px-4 py-4">
        <select
          value={transaction.bankName}
          onChange={(e) => onUpdate(transaction.id, { bankName: e.target.value })}
          className="bg-transparent text-sm font-medium text-slate-600 outline-none focus:text-indigo-600 cursor-pointer"
        >
          {banks.length === 0 && <option value={transaction.bankName}>{transaction.bankName}</option>}
          {banks.map(bank => (
            <option key={bank} value={bank}>{bank}</option>
          ))}
          {!banks.includes(transaction.bankName) && <option value={transaction.bankName}>{transaction.bankName}</option>}
        </select>
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
          className={`text-[10px] font-bold px-2 py-1 rounded-md border-0 ring-1 ring-inset ${
            transaction.type === CategoryType.PERSONAL 
            ? 'bg-blue-50 text-blue-700 ring-blue-600/20' 
            : 'bg-slate-100 text-slate-700 ring-slate-600/20'
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
          className="text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1 outline-none"
        >
          <option value="Uncategorized">Select Tag...</option>
          {tags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <button 
          onClick={() => onDelete(transaction.id)}
          className="text-slate-300 hover:text-red-500 transition-colors p-2"
          title="Delete row"
        >
          <i className="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  );
};