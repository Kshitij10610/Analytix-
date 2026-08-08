# Analytix

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active_Development-yellow?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-0.1.0-blue?style=for-the-badge)

<p align="center">
  <strong>Enterprise Financial Intelligence Platform</strong><br/>
  Build trustworthy financial analysis with complete auditability and traceable evidence.
</p>

---

## Table of Contents

<details>
<summary>Click to expand</summary>

- [Introduction](#introduction)
- [Why Analytix](#why-analytix)
- [Features](#features)
  - [Authentication](#authentication)
  - [Company Management](#company-management)
  - [Financial Statements](#financial-statements)
  - [Ingestion Pipeline](#ingestion-pipeline)
  - [Financial Analysis Dashboard](#financial-analysis-dashboard)
  - [Security](#security)
  - [Developer Experience](#developer-experience)
- [Feature Status](#feature-status)
- [Screenshots](#screenshots)
- [Demo](#demo)
- [Architecture](#architecture)
  - [System Architecture](#system-architecture)
  - [Request Lifecycle](#request-lifecycle)
  - [Authentication Flow](#authentication-flow)
  - [Financial Statement Lifecycle](#financial-statement-lifecycle)
  - [Ingestion Flow](#ingestion-flow)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication-1)
  - [Companies](#companies)
  - [Company Members](#company-members)
  - [Financial Statements](#financial-statements-1)
  - [Ingestion](#ingestion)
  - [Audit](#audit)
  - [Health](#health)
- [Security](#security-1)
- [Performance](#performance)
- [Manual Testing Guide](#manual-testing-guide)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Development Workflow](#development-workflow)
- [Scripts](#scripts)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

</details>

---

## Introduction

Financial software often forces a choice between transparency and convenience. Black-box models promise speed but sacrifice auditability. Spreadsheets offer traceability but stall at scale. **Analytix** exists to eliminate that trade-off.

Analytix is an AI-ready Financial Intelligence Platform designed to transform raw financial statements into structured, auditable, and explainable financial intelligence. It serves businesses, investors, analysts, auditors, and finance professionals who need deep analysis without compromising on trust.

The platform is built around a single philosophy: **trust before AI**. Every financial number traces back to a source document. Every calculation is deterministic and reviewable. Every ingestion step requires human validation. This makes Analytix suitable for environments where regulatory compliance, audit trails, and evidence-based decision-making are non-negotiable.

What makes Analytix different is its evidence-first architecture. Rather than treating the database as an afterthought, every layer of the stack is designed to preserve provenance. From secure multipart uploads with SHA-256 integrity checks to normalized line items with standardized metric codes, the system ensures that no number ever appears without a verifiable origin.

The result is a platform that feels modern and fast—powered by Next.js, NestJS, and PostgreSQL—while maintaining the rigor expected in financial workflows. Client-side analysis keeps sensitive data private. Role-based access control keeps companies secure. And a complete audit trail ensures that every action is accountable.

---

## Why Analytix

| Principle | Implementation |
|-----------|----------------|
| **Trust Before Speed** | Transparency and auditability take precedence over automation. |
| **Evidence-First Architecture** | Every number traces back to a source document, not a black-box model. |
| **Deterministic Calculations** | Financial ratios and trends use explicit, reviewable formulas. |
| **Human-in-the-Loop Ingestion** | Raw data requires human validation before entering the financial record. |
| **Secure by Design** | Enterprise-grade authentication, authorization, and audit logging built in from day one. |

---

## Features

### Authentication

Secure, token-based authentication with refresh support and role-based access control.

- **JWT Authentication** — HS256-signed access tokens for stateless authentication.
- **HTTP-only Cookies** — Refresh tokens stored in HTTP-only cookies to prevent XSS theft.
- **Refresh Tokens** — Long-lived refresh tokens with automatic rotation.
- **Session Restoration** — Automatic session recovery on application reload via the auth provider.
- **Protected Routes** — Route-level access control enforced by NestJS guards.
- **Role Based Access** — Three-tier RBAC: `USER`, `ANALYST`, and `ADMIN` roles.
- **Rate Limiting** — Throttler-based rate limiting (production: 100 req/min short, 1000 req/hr medium).

### Company Management

Full CRUD operations for companies with member management and context switching.

- **Company CRUD** — Create, read, update, and delete companies with metadata.
- **Member Management** — List, add, update roles, remove, transfer ownership, and leave companies.
- **Company Switcher** — Seamless dropdown to switch between managed companies with session persistence.
- **Search** — Client-side search/filter by company name.
- **Sorting** — Client-side sort by company name (A-Z / Z-A).

### Financial Statements

Comprehensive financial statement management with support for multiple statement types.

- **Upload** — Import financial data via the ingestion wizard (CSV, XLSX).
- **Manual Creation** — Create statements directly with line items and metadata.
- **View Statements** — Browse all financial statements for a company.
- **Edit** — Update statement metadata, period, currency, and scale.
- **Delete** — Remove statements with audit trail preservation (admin only).
- **Line Items** — Granular line-item management with standardized metric codes.

### Ingestion Pipeline

Multi-step, auditable pipeline for importing raw financial data.

- **Upload** — Secure multipart upload with size limits, extension whitelisting, and SHA-256 integrity verification.
- **Parse** — Extract raw rows from XLSX and CSV files into a structured intermediate format.
- **Stage** — Persist raw rows in the database for full auditability before transformation.
- **Mapping** — Map raw columns to standardized financial metric codes with human review.
- **Validation** — Validate mapped data against business rules and constraints.
- **Normalization** — Normalize values to standard formats and currencies.
- **Statement Metadata** — Attach statement type, fiscal year, period, and company context.
- **Commit** — Persist the finalized financial statement with a complete audit trail.

### Financial Analysis Dashboard

Client-side financial analysis with interactive visualizations.

- **KPI Cards** — Executive summary displaying key financial metrics.
- **Financial Ratios** — Computed ratios including liquidity, profitability, and leverage metrics.
- **Trend Analysis** — Revenue and profit trends across fiscal periods.
- **Charts** — Line charts, bar charts, and pie charts for asset allocation and liability/equity breakdown.
- **Client-Side Analysis** — All computations run in the browser to protect data privacy.

### Security

Enterprise-grade security built into every layer.

- **Helmet.js** — Security headers with `x-powered-by` disabled.
- **CORS** — Configurable CORS with credential support for local development.
- **Argon2id** — Industry-standard password hashing.
- **JWT + HTTP-only Cookies** — Stateless access tokens with secure refresh mechanism.
- **RBAC** — Role-based access control via custom NestJS guards.
- **Prisma Parameterized Queries** — Automatic SQL injection prevention.
- **Input Validation** — `class-validator` DTO validation on backend, Zod on frontend.
- **Rate Limiting** — Throttler protection against brute-force and abuse.
- **Audit Trail** — Every critical action logged to the `audit_events` table.

### Developer Experience

Built for productivity and maintainability.

- **Type-Safe End-to-End** — TypeScript across frontend, backend, and database layer.
- **Monorepo Structure** — Shared conventions and tooling across apps.
- **Hot Reload** — NestJS and Next.js dev servers with instant feedback.
- **ESLint + Prettier** — Automated code quality and formatting.
- **Design System** — Comprehensive token-based design system with semantic colors, typography, and financial chart palettes.
- **Testing** — Jest and Supertest for unit and integration tests.

---

## Feature Status

| Feature | Status |
|---------|--------|
| Authentication | ✅ |
| Company Management | ✅ |
| Financial Statements | ✅ |
| Ingestion Wizard | ✅ |
| Dashboard | ✅ |
| Audit Logs | 🚧 |
| AI Analysis | ❌ |
| Collaboration | ❌ |
| Export (PDF / CSV / Excel) | ❌ |
| Notifications | ❌ |
| Version History | ❌ |

---

## Screenshots

<!-- Add actual screenshots to `docs/images/` and uncomment the lines below -->

<!-- ![Login Screen](docs/images/login.png) -->
<!-- ![Dashboard](docs/images/dashboard.png) -->
<!-- ![Company Management](docs/images/company.png) -->
<!-- ![Import Wizard](docs/images/import.png) -->
<!-- ![Financial Statements](docs/images/financials.png) -->
<!-- ![Analysis View](docs/images/analysis.png) -->

> **Note:** Screenshots are placeholders. Capture actual application screens and place them in `docs/images/`.

---

## Demo

<!-- Add a demo GIF to `docs/demo.gif` and uncomment the line below -->

<!-- ![Demo](docs/demo.gif) -->

> **Note:** A demo GIF will be added later. Record a walkthrough of the ingestion wizard and dashboard, then place it in `docs/demo.gif`.

---

## Architecture

### System Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend (Next.js 16)"]
        A["Pages & Routes"]
        B["TanStack Query"]
        C["shadcn/ui Components"]
        D["Recharts"]
    end

    subgraph Backend["Backend (NestJS)"]
        E["Controllers"]
        F["Services"]
        G["Guards & Interceptors"]
        H["ValidationPipe"]
    end

    subgraph Database["Database (PostgreSQL)"]
        I["Prisma ORM"]
        J["Tables"]
        K["Audit Events"]
    end

    A --> B --> E
    C --> F
    D --> J
    E --> F --> G --> H --> I --> J
    J --> K
```

### Request Lifecycle

```mermaid
flowchart LR
    A["Browser"] --> B["Next.js"]
    B --> C["Axios"]
    C --> D["NestJS API"]
    D --> E["Prisma"]
    E --> F["PostgreSQL"]
    F --> E
    E --> D
    D --> C
    C --> B
    B --> A
```

### Authentication Flow

```mermaid
flowchart LR
    A["User"] --> B["Login"]
    B --> C["JWT"]
    C --> D["Access Token"]
    D --> E["Session Storage"]
    E --> F["Axios Interceptor"]
    F --> G["Backend"]
    G -->|"401 Unauthorized"| H["Refresh Cookie"]
    H --> I["Retry Request"]
    I --> G
```

### Financial Statement Lifecycle

```mermaid
flowchart LR
    A["Upload / Manual Entry"] --> B["Parser"]
    B --> C["Validation"]
    C --> D["Normalization"]
    D --> E["Database"]
    E --> F["Dashboard"]
    F --> G["Ratio Calculation"]
    G --> H["Charts"]
```

### Ingestion Flow

```mermaid
flowchart LR
    A["Upload"] --> B["Parse"]
    B --> C["Stage"]
    C --> D["Mapping"]
    D --> E["Validation"]
    E --> F["Normalization"]
    F --> G["Commit"]
    G --> H["Financial Statement"]
```

---

## Project Structure

```
C:\Analytix
├── apps/
│   ├── api/                                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/                           # JWT authentication, RBAC guards, DTOs
│   │   │   ├── authorization/                  # Company-level access control service
│   │   │   ├── audit/                          # Audit event logging and querying
│   │   │   ├── companies/                      # Company CRUD and member management
│   │   │   ├── financials/                     # Financial statements and line items
│   │   │   ├── health/                         # Health check endpoint
│   │   │   ├── ingestion/                      # Multi-step ingestion pipeline
│   │   │   ├── prisma/                         # Prisma service and module
│   │   │   ├── generated/                      # Auto-generated Prisma client
│   │   │   ├── app.module.ts                   # Root application module
│   │   │   └── main.ts                         # Application entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                                    # Next.js frontend
│       ├── src/
│       │   ├── app/                            # App Router pages and layouts
│       │   ├── components/                     # Shared UI components (shadcn/ui)
│       │   ├── features/                       # Feature-specific modules
│       │   │   ├── auth/                       # Login, register, forms
│       │   │   ├── companies/                  # Company components and hooks
│       │   │   ├── financials/                 # Statements, dashboard, analysis
│       │   │   └── ingestion/                  # Import wizard steps
│       │   ├── providers/                      # Context providers (auth, theme, query)
│       │   └── lib/                            # Utilities and API client
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                                       # Design system documentation
│   ├── brand-identity.md
│   ├── brand-foundation.md
│   ├── brand-colors.md
│   ├── semantic-colors.md
│   ├── theme-system.md
│   └── financial-chart-colors.md
│
├── infrastructure/                             # Deployment configurations
├── docker-compose.yml                          # PostgreSQL 17 container
├── .env                                        # Environment variables
└── README.md                                   # You are here
```

---

## API Documentation

### Authentication

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `POST` | `/auth/register` | No | Register a new user account |
| `POST` | `/auth/login` | No | Authenticate and receive access token + refresh cookie |
| `POST` | `/auth/refresh` | No | Refresh access token using refresh cookie |
| `POST` | `/auth/logout` | No | Invalidate refresh token and clear cookie |
| `GET` | `/auth/me` | Yes | Retrieve current authenticated user |

### Companies

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `GET` | `/companies` | Yes | List all companies for the current user |
| `GET` | `/companies/:id` | Yes | Retrieve a single company |
| `POST` | `/companies` | Yes | Create a new company |
| `PATCH` | `/companies/:id` | Yes | Update company details |
| `DELETE` | `/companies/:id` | Yes | Delete a company (admin only) |

### Company Members

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `GET` | `/companies/:companyId/members` | Yes | List company members |
| `POST` | `/companies/:companyId/members` | Yes | Add a member to the company |
| `PATCH` | `/companies/:companyId/members/:memberId` | Yes | Update a member's role |
| `DELETE` | `/companies/:companyId/members/:memberId` | Yes | Remove a member |
| `POST` | `/companies/:companyId/members/:memberId/transfer-ownership` | Yes | Transfer company ownership |
| `DELETE` | `/companies/:companyId/members/self/leave` | Yes | Leave a company |

### Financial Statements

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `POST` | `/companies/:companyId/financial-statements` | Yes | Create statement with line items |
| `POST` | `/companies/:companyId/financial-statements/simple` | Yes | Create a simple statement |
| `GET` | `/companies/:companyId/financial-statements` | Yes | List statements for a company |
| `GET` | `/financial-statements/:id` | Yes | Retrieve a single statement |
| `GET` | `/financial-statements/:id/line-items/view` | Yes | Retrieve statement with line items |
| `PATCH` | `/financial-statements/:id` | Yes | Update a statement |
| `DELETE` | `/financial-statements/:id` | Yes | Delete a statement (admin only) |

### Ingestion

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `POST` | `/companies/:companyId/imports/upload` | Yes | Upload a financial file (CSV/XLSX) for ingestion |
| `POST` | `/companies/:companyId/imports/:importJobId/parse` | Yes | Parse uploaded file into raw rows |
| `POST` | `/companies/:companyId/imports/:importJobId/stage` | Yes | Stage raw rows in the database |
| `PUT` | `/companies/:companyId/imports/:importJobId/mapping` | Yes | Confirm column-to-metric mapping |
| `POST` | `/companies/:companyId/imports/:importJobId/validate` | Yes | Validate mapped data |
| `POST` | `/companies/:companyId/imports/:importJobId/normalize` | Yes | Normalize values and currencies |
| `PUT` | `/companies/:companyId/imports/:importJobId/statement-metadata` | Yes | Attach statement metadata |
| `POST` | `/companies/:companyId/imports/:importJobId/commit` | Yes | Commit the finalized statement |

### Audit

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `GET` | `/companies/:companyId/audit-events` | Yes | Query paginated audit events for a company |

### Health

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `GET` | `/health` | No | Application health check |

---

## Security

Analytix implements defense-in-depth security across every layer.

| Layer | Implementation | Why |
|-------|----------------|-----|
| **Authentication** | JWT with HS256 signing for access tokens | Stateless, scalable authentication without session storage |
| **Transport** | HTTP-only cookies for refresh tokens | Prevents XSS token theft; cookies inaccessible to JavaScript |
| **Authorization** | Role-based access control (RBAC) via custom guards | Ensures users only access resources within their permission scope |
| **Rate Limiting** | Throttler with short and medium rate limits | Protects against brute-force attacks and abuse |
| **Headers** | Helmet.js for security headers; `x-powered-by` disabled | Reduces attack surface by removing framework fingerprints |
| **CORS** | Configurable CORS with credential support | Restricts cross-origin requests to trusted origins |
| **Input Validation** | `class-validator` DTO validation on backend inputs | Prevents malformed or malicious payloads from reaching business logic |
| **Frontend Validation** | Zod schema validation on forms and API payloads | Catches errors early and provides user-friendly feedback |
| **Password Hashing** | Argon2id for secure password storage | Resistant to GPU/ASIC cracking; memory-hard algorithm |
| **SQL Injection** | Prisma parameterized queries | Eliminates raw SQL injection vectors by design |
| **Type Safety** | End-to-end TypeScript | Catches type mismatches at compile time across the full stack |
| **Audit Trail** | Every critical action logged to `audit_events` table | Provides complete traceability for compliance and debugging |

---

## Performance

- **React Query Cache** — TanStack Query provides intelligent caching, background refetching, and deduplication.
- **Next.js App Router** — Optimized bundling and routing with file-system-based conventions.
- **Dynamic Routes** — Next.js dynamic segments (`[companyId]`, `[statementId]`) for efficient code splitting.
- **Axios Interceptors** — Centralized request/response handling with auth token injection and automatic refresh on 401.
- **Skeleton Loaders** — Loading states for async data to improve perceived performance.
- **Responsive UI** — Mobile-first Tailwind CSS with adaptive layouts and breakpoints.
- **Prisma Query Optimization** — Efficient database queries with selective field inclusion.

---

## Manual Testing Guide

Follow these steps to manually verify the application:

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

**Expected result:** PostgreSQL is running on `localhost:5433`.

### 2. Run Backend

```bash
cd apps/api
npm install
npm run dev
```

**Expected result:** NestJS starts on `http://localhost:4000` with hot reload enabled.

### 3. Run Frontend

```bash
cd apps/web
npm install
npm run dev
```

**Expected result:** Next.js starts on `http://localhost:3000`.

### 4. Register User

- Navigate to `http://localhost:3000/register`
- Create a new account with name, email, and password

**Expected result:** Account is created and redirected to login or dashboard.

### 5. Login

- Navigate to `http://localhost:3000/login`
- Authenticate with registered credentials

**Expected result:** User is authenticated, session is restored, and redirected to dashboard.

### 6. Create Company

- Navigate to Companies
- Click "Create Company" and fill in company details

**Expected result:** Company is created and visible in the company list.

### 7. Upload Statement

- Open a company
- Use the ingestion wizard to upload a CSV or XLSX financial file
- Walk through Upload → Parse → Mapping → Validation → Normalization → Commit

**Expected result:** Financial statement is created with line items and appears in the statements list.

### 8. View Dashboard

- Navigate to Dashboard
- Verify KPI cards render
- Verify charts (line, bar, pie) render
- Verify financial ratios table populates

**Expected result:** Dashboard displays analysis based on uploaded statements.

### 9. Verify Members

- Open company details
- View the Members tab
- Verify member list renders

**Expected result:** Members table displays company members.

### 10. Delete Company

- Open company details
- Delete the company (requires admin role)

**Expected result:** Company is deleted and user is redirected to the companies list.

---

## Environment Variables

### Backend (`apps/api/.env`)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | — |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access tokens (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens (min 32 chars, must differ from access secret) | — |
| `PORT` | No | Server port | `4000` |
| `NODE_ENV` | No | Environment mode (`development`, `production`) | `development` |

```env
# Database connection string
DATABASE_URL="postgresql://user:password@localhost:5433/analytix"

# JWT secrets (minimum 32 characters, must be different)
JWT_ACCESS_SECRET=your-super-secret-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Server port (default: 4000)
PORT=4000

# Environment mode
NODE_ENV=development
```

### Frontend (`apps/web/.env.local`)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL | — |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend application URL | — |

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Installation

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 17
- Docker & Docker Compose (optional)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/analytix.git
cd analytix

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and secrets

# 4. Start PostgreSQL
docker-compose up -d

# 5. Run database migrations
npm run prisma:migrate

# 6. Start the backend
npm run dev:api

# 7. Start the frontend (in a new terminal)
npm run dev:web

# 8. Open your browser
# Frontend: http://localhost:3000
# API: http://localhost:4000
```

---

## Development Workflow

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make changes** following the existing architecture patterns (NestJS modules, Next.js App Router)

3. **Run linting** before committing
   ```bash
   # Backend
   cd apps/api && npm run lint

   # Frontend
   cd apps/web && npm run lint
   ```

4. **Run tests** to verify correctness
   ```bash
   # Backend
   cd apps/api && npm run test

   # Frontend
   cd apps/web && npm run typecheck
   ```

5. **Commit** with clear, conventional commit messages
   ```
   feat: add export endpoint for financial statements
   fix: prevent duplicate company creation on race condition
   ```

6. **Push** to your branch and open a Pull Request

---

## Scripts

### Backend (`apps/api`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start NestJS with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Start compiled application |
| `npm run start:prod` | Start production server from `dist/` |
| `npm run lint` | Run ESLint on `src/**/*.ts` |
| `npm run test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Generate Jest coverage report |
| `npm run test:debug` | Debug tests with Node inspector |

### Frontend (`apps/web`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |

---

## Known Limitations

These are verified limitations based on the current codebase:

- **Export Endpoints** — PDF, CSV, and Excel export buttons exist in the dashboard UI but are disabled. Backend endpoints are not implemented.
- **Forgot Password** — The forgot password page is a placeholder with no backend reset flow.
- **Email Verification** — No email verification is implemented.
- **Import History** — No dedicated endpoint exists to browse past ingestion jobs.
- **No AI Features** — No AI-powered analysis, natural language queries, or auto-generated summaries are implemented.
- **No Real-Time Collaboration** — Multi-user collaboration is not implemented.
- **No Notifications** — Email and in-app notification systems are not implemented.
- **No Version History** — Statement change tracking and restore are not implemented.

---

## Roadmap

### Completed

- [x] JWT Authentication with Refresh Tokens
- [x] HTTP-only Cookie-based Session Management
- [x] Role Based Access Control (RBAC)
- [x] Rate Limiting (Throttler)
- [x] Company Management (CRUD + Members)
- [x] Company Switcher
- [x] Financial Statements (CRUD + Line Items)
- [x] Financial Analysis Dashboard (Client-side)
- [x] KPI Cards & Financial Ratios
- [x] Trend Analysis & Charts (Recharts)
- [x] Full Ingestion Pipeline (Upload → Parse → Stage → Map → Validate → Normalization → Metadata → Commit)
- [x] Audit Logging (All actions tracked)
- [x] Responsive UI (Mobile-first)
- [x] Dark Mode Support
- [x] Search & Sorting
- [x] Type-safe API with Zod Validation

### Planned

- [ ] **AI Financial Analyst** — AI-powered financial insights and commentary
- [ ] **Natural Language Queries** — Ask questions about financial data in plain English
- [ ] **Executive Summary** — Auto-generated AI executive summaries
- [ ] **Forecasting** — Revenue and cash flow forecasting models
- [ ] **Scenario Analysis** — What-if scenario modeling
- [ ] **PDF Export** — Export statements and reports to PDF
- [ ] **Excel Export** — Export line items to XLSX
- [ ] **CSV Export** — Export data to CSV format
- [ ] **Import History** — Browse past ingestion jobs and their status
- [ ] **Report Builder** — Custom report builder with drag-and-drop
- [ ] **Collaboration** — Multi-user real-time collaboration
- [ ] **Notifications** — Email and in-app notifications
- [ ] **Version History** — Track changes and restore previous versions
- [ ] **Password Reset** — Backend email-based password reset flow

---

## Contributing

We welcome contributions from the community. Please follow these steps:

1. **Fork** the repository
2. **Clone** your fork locally
   ```bash
   git clone https://github.com/your-username/analytix.git
   ```
3. **Install** dependencies for both apps
   ```bash
   cd apps/api && npm install
   cd ../web && npm install
   ```
4. **Run** the backend and frontend
   ```bash
   # Terminal 1 — Backend
   cd apps/api
   npm run dev

   # Terminal 2 — Frontend
   cd apps/web
   npm run dev
   ```
5. **Create** a feature branch
   ```bash
   git checkout -b feat/your-feature-name
   ```
6. **Commit** your changes with clear, conventional commit messages
7. **Push** to your branch
8. **Open** a Pull Request with a description of changes

### Coding Standards

- TypeScript strict mode enabled across both apps
- ESLint + Prettier for consistent formatting
- Conventional commits for git history
- Test coverage required for new features
- Follow existing architecture patterns (NestJS modules, Next.js App Router)

---

## License

[MIT](LICENSE)

---

<p align="center">
  Built with ❤️ using Next.js, NestJS, Prisma, PostgreSQL, and TypeScript
</p>

<p align="center">
  <strong>Analytix — Financial Intelligence You Can Trust.</strong>
</p>

<p align="center">
  <a href="#analytix">Back to top ↑</a>
</p>
