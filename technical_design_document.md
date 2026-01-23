# Technical Design Document: Adjusted Cost Base (ACB) Calculator

## 1. System Architecture Overview
The ACB Calculator is a full-stack web application designed to track investment transactions and calculate Adjusted Cost Base (ACB) for Canadian tax purposes. It uses a **Client-Server** architecture where a React frontend communicates with a Node.js/Express backend via a RESTful API. The backend persists data to a local SQLite database using an ORM.

### High-Level Architecture (C4 Context)

```mermaid
C4Context
    title System Context Diagram for ACB Calculator

    Person(user, "User", "Individual Investor")
    System_Boundary(acb_system, "ACB Calculator System") {
        Container(web_app, "Web Application", "React, Vite", "Provides the UI for managing transactions and viewing reports")
        Container(api_service, "API Service", "Node.js, Express", "Handles business logic, calculations, and data persistence")
        ContainerDb(database, "Database", "SQLite, TypeORM", "Stores securities, accounts, transactions, and positions")
    }

    Rel(user, web_app, "Uses", "HTTPS")
    Rel(web_app, api_service, "Makes API calls to", "JSON/HTTP")
    Rel(api_service, database, "Reads/Writes", "SQL")
```

## 2. Tech Stack & Infrastructure

### Frontend
-   **Language:** TypeScript
-   **Framework:** React 18
-   **Build Tool:** Vite
-   **State Management:** React Hooks (`useState`, `useEffect`, `useContext`)
-   **Styling:** CSS Modules / Standard CSS
-   **HTTP Client:** Native `fetch` API

### Backend
-   **Language:** TypeScript
-   **Runtime:** Node.js
-   **Framework:** Express
-   **ORM:** TypeORM
-   **Database:** SQLite (via `sql.js` / `sqlite3`)
-   **Math Library:** `decimal.js` (Crucial for financial precision)
-   **Testing:** Jest, ts-jest

### Infrastructure & Tools
-   **Package Manager:** npm
-   **Version Control:** Git
-   **Linting/Formatting:** ESLint, Prettier (implied)

## 3. Data Schema & Relational Model
The database is normalized and centers around the `Transaction` entity, which drives the `Position` calculations.

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    SECURITY ||--o{ TRANSACTION : "related to"
    SECURITY ||--o{ POSITION : "has"
    SECURITY ||--o{ CORPORATE_ACTION : "has actions"
    ACCOUNT ||--o{ TRANSACTION : "contains"
    ACCOUNT ||--o{ POSITION : "holds"
    
    SECURITY {
        string id PK
        string symbol
        string name
        string currency
        string type
        string exchange
    }

    ACCOUNT {
        string id PK
        string name
        string type
        string institution
        string accountNumber
    }

    TRANSACTION {
        string id PK
        date date
        date settlementDate
        string type
        decimal quantity
        decimal price
        decimal fees
        decimal fxRate
        decimal acbBefore
        decimal acbAfter
        decimal capitalGain
    }

    POSITION {
        string id PK
        decimal shares
        decimal totalAcb
    }

    CORPORATE_ACTION {
        string id PK
        date date
        string type
        decimal ratio
    }

    FX_RATE {
        string id PK
        date date
        string fromCurrency
        string toCurrency
        decimal rate
    }
```

### Table Definitions

#### `securities`
| Field | Type | Description |
|---|---|---|
| `id` | VARCHAR(36) | Primary Key (UUID) |
| `symbol` | VARCHAR(20) | Ticker symbol (e.g., RY.TO) |
| `name` | VARCHAR(255) | Full name of the security |
| `currency` | VARCHAR(3) | Trading currency (default CAD) |
| `type` | VARCHAR(20) | Type: stock, etf, bond, etc. |

#### `accounts`
| Field | Type | Description |
|---|---|---|
| `id` | VARCHAR(36) | Primary Key (UUID) |
| `name` | VARCHAR(100) | User-defined name (e.g., "Questrade TFSA") |
| `type` | VARCHAR(20) | Registered status (TFSA, RRSP, Non-Reg) |

#### `transactions`
| Field | Type | Description |
|---|---|---|
| `id` | VARCHAR(36) | Primary Key (UUID) |
| `date` | DATE | Trade date |
| `type` | VARCHAR(20) | buy, sell, dividend, etc. |
| `securityId` | FK | Reference to Security |
| `accountId` | FK | Reference to Account |
| `quantity` | DECIMAL(15,6) | Number of shares |
| `price` | DECIMAL(15,4) | Price per share |
| `acbAfter` | DECIMAL(15,2) | Calculated running ACB |

#### `positions`
| Field | Type | Description |
|---|---|---|
| `id` | VARCHAR(36) | Primary Key (UUID) |
| `securityId` | FK | Reference to Security |
| `accountId` | FK | Reference to Account |
| `shares` | DECIMAL(15,6) | Current quantity held |
| `totalAcb` | DECIMAL(15,2) | Total Book Value |

## 4. API Surface & Contracts

### Transactions API
-   `GET /api/transactions`
    -   **Query Params**: `securityId`, `accountId`
    -   **Response**: `Transaction[]`
-   `GET /api/transactions/:id`
    -   **Response**: `Transaction`
-   `POST /api/transactions`
    -   **Body**: `{ date, type, securityId, accountId, quantity, price, ... }`
    -   **Response**: Created `Transaction`
-   `PUT /api/transactions/:id`
    -   **Body**: Partial transaction fields
    -   **Response**: Updated `Transaction`
-   `DELETE /api/transactions/:id`
    -   **Response**: 204 No Content

### Securities API
-   `GET /api/securities`
-   `POST /api/securities`
-   `DELETE /api/securities/:id`

### Accounts API
-   `GET /api/accounts`
-   `POST /api/accounts`
-   `DELETE /api/accounts/:id`

### Positions API
-   `GET /api/positions`
    -   **Response**: List of current holdings with ACB

### FX Rates API
-   `GET /api/fx-rates`

## 5. Backend Service Logic

### `TransactionService`
Facilitates CRUD operations and orchestrates the calculation flow.
-   **Role**: Entry point for transaction manipulation.
-   **Key Logic**: When a transaction is created, updated, or deleted, it triggers `ACBCalculatorService` to re-process the chain of transactions for that security.

### `ACBCalculatorService`
The core engine for determining tax implications.
-   **Role**: Iterates through transactions chronologically to compute `acbBefore`, `acbAfter`, and `capitalGain`.
-   **Logic**:
    -   **Buy**: Increases Total ACB.
    -   **Sell**: Decreases Total ACB by proportion of shares sold. Calculates Capital Gain = (Proceeds - transaction costs) - (Avg Cost * Shares Sold).
    -   **ROC (Return of Capital)**: Reduces ACB without changing share count.

### `SuperficialLossService`
Handles the complex "Superficial Loss" rule (Canada's wash sale rule).
-   **Role**: Detects if a loss is denied because the same security was purchased 30 days before or after the settlement date.
-   **Logic**:
    -   Scans for matching buys within the 61-day window.
    -   If found, adds the denied loss to the ACB of the substituted property.

### `FXRateService`
-   **Role**: Provides exchange rates for foreign securities.
-   **Logic**: Lookups up `FXRate` entity. Used to convert USD trades to CAD for valid CRA reporting.

## 6. Frontend Module Architecture
The frontend is a Single Page Application (SPA).

### Directory Structure
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── TransactionForm.tsx  # Add/Edit transactions
│   │   ├── TransactionTable.tsx # Data grid with filtering
│   │   ├── PositionSummary.tsx  # Portfolio dashboard
│   │   └── SetupPanel.tsx       # Manage Accounts/Securities
│   ├── services/        # API client modules
│   │   └── api.ts       # Centralized fetch wrappers (Axios/Fetch)
│   ├── styles/          # CSS files
│   ├── App.tsx          # Main Layout & State Container
│   └── main.tsx         # Entry point
```

### State Management
-   **Local State**: `App.tsx` holds the master state for `securities`, `accounts`, `transactions`, and `positions`.
-   **Data Flow**: Data is fetched on mount in `App.tsx` and passed down as props to `TransactionTable`, `PositionSummary`, etc.
-   **Updates**: Handler functions (`handleAddTransaction`, etc.) in `App.tsx` call the API service and then update the local state (optimistically or by re-fetching).

## 7. Core User Flows

### Flow 1: Adding a Buy Transaction
The user manually enters a trade. The system calculates the new Average Cost.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as API Server
    participant TS as TransactionService
    participant ACS as ACBCalculatorService
    participant DB as Database

    User->>FE: Fill Buy Form (Symbol, Qty, Price)
    FE->>API: POST /api/transactions
    API->>TS: createTransaction(data)
    TS->>DB: Save initial transaction
    TS->>ACS: recalculateAcb(securityId, accountId)
    ACS->>DB: Fetch all transactions sorted by date
    ACS->>ACS: Compute ACB chain
    ACS->>DB: Batch update transactions
    TS-->>API: Return transaction
    API-->>FE: Return success
    FE-->>User: Update Table
```

### Flow 2: Selling a Security (Capital Gain Calculation)
The user sells shares. The system determines the cost basis to calculate gain/loss.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as API Server
    participant TS as TransactionService
    participant ACS as ACBCalculatorService

    User->>FE: Fill Sell Form (Symbol, Qty, Price)
    FE->>API: POST /api/transactions
    API->>TS: createTransaction(data)
    TS->>ACS: recalculateAcb(securityIdArg)
    ACS->>ACS: Get Avg Cost from previous state
    ACS->>ACS: Calculate Gain = Proceeds - (AvgCost * Qty)
    ACS->>ACS: Check Superficial Loss (via SuperficialLossService)
    ACS->>DB: Update Transaction(CapitalGain, AcbAfter)
    TS-->>FE: Return complete transaction
    FE-->>User: Display realized gain/loss
```

### Flow 3: Viewing Portfolio Positions
User wants to see their current holdings and book value.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as API Server
    participant DB as Database

    User->>FE: Click "Positions" Tab
    FE->>API: GET /api/positions
    API->>DB: Select * from positions
    DB-->>API: Return position rows
    API-->>FE: Return JSON list
    FE->>FE: Render Position Summary Table
    FE-->>User: Show Holdings & Unrealized Gains
```
