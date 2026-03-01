# InventoryPro - Inventory Management System

## Overview
A professional inventory management system built with Node.js, Express, React, and PostgreSQL. Features product management, multi-product invoice sales, expense recording, customer due management, payment tracking, investor management, and a comprehensive dashboard with business analytics. All monetary values are displayed in Bangladeshi Taka (৳). Multi-user support with JWT-based authentication and per-user data isolation.

## Architecture
- **Frontend:** React + TypeScript with Shadcn UI components, TanStack Query, Wouter routing
- **Backend:** Express.js API server with JWT auth middleware
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS with Shadcn design system
- **Auth:** Email/password registration & login with bcrypt + JWT; Google OAuth ready (endpoint exists at `/api/auth/google`)

## Key Features
- **Authentication:** Email/password register/login with JWT tokens (30-day expiry); Google OAuth endpoint ready for future activation; all data isolated per user via `user_id` foreign keys
- **Dashboard:** Total Sales, Investment, Stock Value, Expenses, Profit, Cash In Hand, Low Stock Alerts, Working Capital, Daily & Monthly Sales/Profit summaries, COD Summary (Pending/Delivered/Returned/Total COD from courier orders)
- **Products:** Add/delete products with cost price, sale price, stock tracking, and manual stock adjustment (Add/Reduce/Set Exact with history logging)
- **Sales:** Invoice-style multi-product sales with automatic stock reduction per item, editable sale price per line item (pre-filled from default, supports custom pricing above/below default including loss), optional customer assignment, partial payment with due tracking
- **Expenses:** Track business expenses with categories; "Permanent Asset" category separated from normal expenses (excluded from profit, daily/monthly summaries, but reduces Cash In Hand); summary cards show Total Expenses and Total Permanent Assets
- **Purchases:** Record stock purchases with automatic stock increase
- **Customers:** Add/view customers with due amount tracking
- **Payments:** Record/delete customer payments that adjust their due amounts (delete restores due)
- **Investors:** Track investor contributions with cash/product types
- **Steadfast Courier:** Dynamic API config stored in DB (changeable from UI); send sales to Steadfast courier with editable COD amount per order; track status (pending/delivered/cancelled/returned); delete pending courier orders (restores stock, only pending allowed); when delivered, COD amount added to Cash In Hand and profit via paidAmount update
- **Customer Details:** View individual customer transaction history (sales + payments), total sales, total paid, current due
- **Invoice System:** Generate printable/downloadable PDF invoices for any sale, with customizable company name/address, optional delivery charge (invoice-only, doesn't affect profit/stock/dashboard), print and PDF download buttons, editable payment status (Fully Paid/Fully Due/Partial Payment) that saves to database and updates customer due amounts

## Data Model
- `users` - name, email (unique), password (bcrypt hash), googleId (nullable, for future Google OAuth)
- `products` - userId, name, productCode (unique per user), costPrice, salePrice, stock
- `stock_history` - productId, previousStock, newStock, changeAmount, reason, createdAt
- `sales` - userId, totalPrice, customerId, customerName, customerPhone, customerAddress, paidAmount, dueAmount, courierStatus, consignmentId, isSentToCourier
- `sale_items` - saleId, productId, productName, quantity, unitPrice, costPrice, totalPrice
- `expenses` - userId, description, amount, category
- `suppliers` - userId, name, phone, address, dueAmount (table kept but hidden from UI)
- `purchases` - userId, productId, productName, supplierId, supplierName, quantity, unitCost, totalCost
- `customers` - userId, name, phone, address, dueAmount
- `payments` - userId, customerId, customerName, amount
- `investors` - userId, name, investedAmount, investmentType (cash/product), productId (nullable), isPermanent
- `steadfast_config` - userId, apiKey, secretKey, baseUrl, createdAt (one row per user, replaced on save)

## File Structure
- `shared/schema.ts` - Drizzle schemas, types, DashboardStats interface
- `server/auth.ts` - JWT token generation/verification, auth middleware
- `server/db.ts` - Database connection with pool configuration
- `server/storage.ts` - Data access layer with transactional operations, all methods accept userId for data isolation
- `server/routes.ts` - API endpoints with auth middleware protecting all /api routes except /api/auth/*
- `server/steadfast.ts` - Steadfast API client (createSteadfastOrder, checkSteadfastStatus)
- `client/src/hooks/use-auth.tsx` - Auth context provider with login/register/logout, JWT token management via localStorage
- `client/src/pages/auth.tsx` - Login/Register page with email+password form
- `client/src/pages/` - Dashboard, Products, Sales, Expenses, Purchases, Customers, CustomerDetails, Payments, Investors, Steadfast pages
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with user info and logout button
- `client/src/components/invoice-modal.tsx` - Invoice generation modal with preview, print, and PDF download
- `client/src/lib/queryClient.ts` - API request helpers with automatic JWT token injection in Authorization header

## API Endpoints
### Auth (unprotected)
- `POST /api/auth/register` - Register with name, email, password
- `POST /api/auth/login` - Login with email, password
- `POST /api/auth/google` - Google OAuth login (ready for future use)
- `GET /api/auth/me` - Get current user (requires JWT)

### Protected (requires Bearer token)
- `GET /api/dashboard` - Dashboard stats (user-scoped)
- `GET/POST /api/products`, `PATCH/DELETE /api/products/:id`
- `GET/POST /api/sales`, `DELETE /api/sales/:id`
- `GET/POST /api/expenses`, `DELETE /api/expenses/:id`
- `GET/POST /api/purchases`
- `GET/POST /api/customers`, `GET/DELETE /api/customers/:id`
- `GET/POST /api/payments`, `DELETE /api/payments/:id`
- `GET/POST /api/investors`, `DELETE /api/investors/:id`
- `GET/POST /api/steadfast-config`
- `GET /api/courier-sales`
- `POST /api/steadfast/send/:id`, `DELETE /api/steadfast/order/:id`, `POST /api/steadfast/status/:id`

## Design Decisions
- Multi-user architecture: all data tables have `user_id` column; all queries filter by authenticated user's ID
- JWT tokens stored in localStorage; sent via Authorization header on all API requests
- Google OAuth endpoint preserved at `/api/auth/google` for future activation (requires VITE_GOOGLE_CLIENT_ID env var)
- Products have unique productCode for barcode/QR scanning; required when creating new products
- Sales support barcode scanning input (Enter key trigger) plus manual product selection dropdown
- Sales use `sale_items` table for multi-product invoices
- All stock/due operations use database transactions for atomicity
- Steadfast Courier: API credentials stored per user in `steadfast_config` DB table; auto-sync interval checks all users' courier orders every 30 minutes

## Critical Notes
- tsx binary symlink breaks after every npm install. Fix: `ln -sf ../tsx/dist/cli.mjs node_modules/.bin/tsx && chmod +x node_modules/.bin/tsx`
- Never install html2pdf.js — use html2canvas+jspdf instead
- All devDependencies were moved to dependencies to work with NODE_ENV=production in the Replit environment
