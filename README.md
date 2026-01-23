# ACB Calculator

A full-stack TypeScript web application for Canadian investors to calculate Adjusted Cost Base (ACB) and capital gains with full CRA compliance, transparency, and auditability.

## Features

- **ACB Tracking**: Automatic calculation of Adjusted Cost Base for all transactions
- **Transaction Types**: Buy, sell, dividends, DRIP, return of capital, stock splits, consolidations, mergers, spinoffs
- **FX Conversion**: Automatic Bank of Canada exchange rate lookup for foreign currency transactions
- **Superficial Loss Detection**: Flags sales at a loss with repurchases within ±30 days
- **Audit Trail**: Full calculation breakdown for every transaction
- **Export**: Download transactions as CSV or JSON

## Quick Start

### Prerequisites

- **Node.js 18+** (required for TypeScript ESM support and testing)
- npm 9+

### Installation

```bash
cd "d:\Workspace\AdjustedCostBase Calculator"
npm install
```

### Run Development Servers

```bash
npm run dev
```

This starts both the backend API (http://localhost:3000) and frontend (http://localhost:5173).

### Debugging

There are two ways to run the application in debug mode:

**Option 1: VS Code (Recommended)**

1. Open the "Run and Debug" side bar in VS Code (`Ctrl+Shift+D`).
2. Select **"Full Stack Debug"** from the dropdown.
3. Press Play (`F5`).
   - This keeps the backend attached to the debugger (for breakpoints in API/Service logic).
   - Launches a Chrome instance for frontend debugging.

**Option 2: Terminal**

```bash
npm run debug
```

This starts both services concurrently. The backend listens for a debugger on port 9229.

### Run Tests

```bash
npm test
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + TypeScript |
| Frontend | React + Vite + TypeScript |
| Database | SQLite + TypeORM |
| Testing | Jest |

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── entities/      # TypeORM data models
│   │   ├── services/      # Business logic (ACB calculator, FX, superficial loss)
│   │   ├── routes/        # REST API endpoints
│   │   └── utils/         # Decimal math utilities
│   └── tests/             # Unit tests
├── frontend/
│   └── src/
│       ├── components/    # React components
│       ├── services/      # API client
│       └── styles/        # CSS files
└── package.json           # Monorepo root
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/securities` | GET, POST | List/create securities |
| `/api/accounts` | GET, POST | List/create accounts |
| `/api/transactions` | GET, POST | List/create transactions |
| `/api/transactions/:id` | PUT, DELETE | Update/delete transaction |
| `/api/positions` | GET | Current holdings with ACB |
| `/api/fx-rates/rate` | GET | Get exchange rate |
| `/api/export/csv` | GET | Export as CSV |

## Usage

1. **Setup**: Add your securities (stocks, ETFs) and accounts in the Setup tab
2. **Add Transactions**: Enter your trades with date, quantity, price, and fees
3. **View Results**: See ACB calculations and capital gains in real-time
4. **Export**: Download your transaction history for tax filing

## Important Notes

- All ACB values are calculated and stored in Canadian dollars (CAD)
- Foreign currency transactions are converted using Bank of Canada rates
- This tool is for informational purposes only - consult a tax professional for advice
- Superficial losses are flagged but not automatically applied - user confirmation required

## License

MIT
