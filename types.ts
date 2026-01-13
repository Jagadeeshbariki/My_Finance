
export enum CategoryType {
  PERSONAL = 'Personal',
  OFFICE = 'Office'
}

export enum TransactionDirection {
  SPENT = 'Spent',
  RECEIVED = 'Received'
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  bankName: string;
  direction: TransactionDirection;
  type: CategoryType;
  status: 'pending' | 'approved';
  tag: string;
}

export interface DashboardStats {
  totalPersonal: number;
  totalOffice: number;
  totalReceived: number;
  totalSpent: number;
}
