const API_BASE = '/api';

export interface Security {
    id: string;
    symbol: string;
    name: string;
    currency: string;
    type: string;
    exchange?: string;
}

export interface Account {
    id: string;
    name: string;
    type: string;
    institution?: string;
}

export interface Transaction {
    id: string;
    date: string;
    settlementDate: string;
    type: string;
    securityId: string;
    security?: Security;
    accountId: string;
    account?: Account;
    quantity: number;
    price: number;
    priceCurrency: string;
    fees: number;
    fxRate: number;
    acbBefore: number;
    acbAfter: number;
    sharesBefore: number;
    sharesAfter: number;
    capitalGain?: number;
    ratio?: number;
    notes?: string;
    flags?: string[];
    calculationDetails?: {
        type: string;
        steps: Array<{
            description: string;
            formula?: string;
            values?: Record<string, string>;
            result?: string;
        }>;
        summary: string;
        superficialLoss?: {
            isSuperficial: boolean;
            lossAmount: number;
            explanation: string;
            adjustmentRequired: string;
        };
    };
}

export interface Position {
    id: string;
    securityId: string;
    security?: Security;
    accountId: string;
    account?: Account;
    shares: number;
    totalAcb: number;
    acbPerShare: number;
}

export interface CreateTransactionInput {
    date: string;
    settlementDate?: string;
    type: string;
    securityId: string;
    accountId: string;
    quantity: number;
    price: number;
    fees?: number;
    ratio?: number;
    rocPerShare?: number;
    notes?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Request failed');
    }
    return response.json();
}

// Securities API
export async function getSecurities(): Promise<Security[]> {
    const response = await fetch(`${API_BASE}/securities`);
    return handleResponse<Security[]>(response);
}

export async function createSecurity(data: Partial<Security>): Promise<Security> {
    const response = await fetch(`${API_BASE}/securities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse<Security>(response);
}

export async function deleteSecurity(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/securities/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error('Failed to delete security');
    }
}

// Accounts API
export async function getAccounts(): Promise<Account[]> {
    const response = await fetch(`${API_BASE}/accounts`);
    return handleResponse<Account[]>(response);
}

export async function createAccount(data: Partial<Account>): Promise<Account> {
    const response = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse<Account>(response);
}

export async function deleteAccount(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/accounts/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error('Failed to delete account');
    }
}

// Transactions API
export async function getTransactions(securityId?: string, accountId?: string): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (securityId) params.append('securityId', securityId);
    if (accountId) params.append('accountId', accountId);

    const url = params.toString()
        ? `${API_BASE}/transactions?${params}`
        : `${API_BASE}/transactions`;

    const response = await fetch(url);
    return handleResponse<Transaction[]>(response);
}

export async function createTransaction(data: CreateTransactionInput): Promise<Transaction> {
    const response = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse<Transaction>(response);
}

export async function updateTransaction(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse<Transaction>(response);
}

export async function deleteTransaction(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error('Failed to delete transaction');
    }
}

// Positions API
export async function getPositions(): Promise<Position[]> {
    const response = await fetch(`${API_BASE}/positions`);
    return handleResponse<Position[]>(response);
}

// FX Rates API
export async function getFxRate(date: string, from: string, to: string): Promise<{ rate: number }> {
    const params = new URLSearchParams({ date, from, to });
    const response = await fetch(`${API_BASE}/fx-rates/rate?${params}`);
    return handleResponse<{ rate: number }>(response);
}

// Export API
export function getExportCsvUrl(): string {
    return `${API_BASE}/export/csv`;
}

export function getExportJsonUrl(): string {
    return `${API_BASE}/export/json`;
}
