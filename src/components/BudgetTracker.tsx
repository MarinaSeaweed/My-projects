import React, { useState } from 'react';
import { Expense } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DollarSign, Plus, Trash2, Wallet } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];

export default function BudgetTracker({
  totalBudget,
  expenses,
  setExpenses,
  currency
}: {
  totalBudget: number;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  currency: string;
}) {
  const [newExpense, setNewExpense] = useState({ category: 'food' as Expense['category'], amount: 0, description: '' });

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = totalBudget - totalSpent;

  const data = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const addExpense = () => {
    if (newExpense.amount <= 0) return;
    setExpenses([...expenses, { ...newExpense, id: Date.now().toString(), date: new Date().toISOString() }]);
    setNewExpense({ category: 'food', amount: 0, description: '' });
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="text-lg font-serif mb-6">Budget Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-4">
            <div className="text-3xl font-serif text-emerald-600">{remaining.toLocaleString()} {currency}</div>
            <div className="text-sm text-stone-500">Remaining Budget</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            Add Expense
          </h3>
          <div className="space-y-4">
            <input 
                type="text" 
                placeholder="Description" 
                className="w-full px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl"
                value={newExpense.description}
                onChange={e => setNewExpense({...newExpense, description: e.target.value})}
            />
            <input 
                type="number" 
                placeholder="Amount" 
                className="w-full px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl"
                value={newExpense.amount || ''}
                onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
            />
            <select 
                className="w-full px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl"
                value={newExpense.category}
                onChange={e => setNewExpense({...newExpense, category: e.target.value as any})}
            >
                <option value="food">Food</option>
                <option value="flights">Flights</option>
                <option value="accommodation">Accommodation</option>
                <option value="activities">Activities</option>
                <option value="other">Other</option>
            </select>
            <button 
                onClick={addExpense}
                className="w-full py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800"
            >
                Add Expense
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
        <h3 className="text-lg font-serif mb-4">Expenses Log</h3>
        <div className="space-y-2">
            {expenses.map(e => (
                <div key={e.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <div>
                        <div className="font-medium text-stone-900">{e.description}</div>
                        <div className="text-xs text-stone-500 capitalize">{e.category}</div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="font-mono">{e.amount.toLocaleString()} {currency}</div>
                        <button onClick={() => removeExpense(e.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
