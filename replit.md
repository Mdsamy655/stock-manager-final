# InventoryPro - Inventory Management System

## Overview
A professional inventory management system built with Node.js, Express, React, and PostgreSQL. Features product management, multi-product invoice sales, expense recording, customer due management, payment tracking, investor management, and a comprehensive dashboard with business analytics. All monetary values are displayed in Bangladeshi Taka (৳).

## Architecture
- **Frontend:** React + TypeScript with Shadcn UI components, TanStack Query, Wouter routing
- **Backend:** Express.js API server
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS with Shadcn design system

## Key Features
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
- `products` - name, productCode (unique barcode/QR code), costPrice, salePrice, stock (manual adjustment via Adjust Stock modal)
- `stock_history` - productId, previousStock, newStock, changeAmount, reason, createdAt
- `sales` - totalPrice, customerId, customerName, customerPhone, customerAddress, paidAmount, dueAmount, courierStatus, consignmentId, isSentToCourier (legacy nullable fields: productId, productName, quantity, unitPrice, costPrice)
- `sale_items` - saleId, productId, productName, quantity, unitPrice, costPrice, totalPrice
- `expenses` - description, amount, category
- `suppliers` - name, phone, address, dueAmount (table kept but hidden from UI)
- `purchases` - productId, productName, supplierId, supplierName, quantity, unitCost, totalCost
- `customers` - name, phone, address, dueAmount
- `payments` - customerId, customerName, amount
- `investors` - name, investedAmount, investmentType (cash/product), productId (nullable), isPermanent (boolean, legacy - always false for new records)
- `steadfast_config` - id, apiKey, secretKey, baseUrl, createdAt (single row, replaced on save)

## File Structure
- `shared/schema.ts` - Drizzle schemas, types, DashboardStats interface
- `server/db.ts` - Database connection with pool configuration
- `server/storage.ts` - Data access layer with transactional operations
- `server/routes.ts` - API endpoints
- `client/src/pages/` - Dashboard, Products, Sales, Expenses, Purchases, Customers, CustomerDetails, Payments, Investors, Steadfast pages
- `client/src/components/app-sidebar.tsx` - Navigation sidebar (Suppliers hidden)
- `client/src/components/invoice-modal.tsx` - Invoice generation modal with preview, print, and PDF download (uses html2canvas + jspdf)

## API Endpoints
- `GET /api/dashboard` - Dashboard stats (includes cash in hand, working capital, daily/monthly profit)
- `GET/POST /api/products`, `PATCH/DELETE /api/products/:id`
- `GET/POST /api/sales`, `DELETE /api/sales/:id`
- `GET/POST /api/expenses`, `DELETE /api/expenses/:id`
- `GET/POST /api/purchases`
- `GET/POST /api/customers`, `GET/DELETE /api/customers/:id`
- `GET/POST /api/payments`, `DELETE /api/payments/:id` (delete restores customer due)
- `GET/POST /api/investors`, `DELETE /api/investors/:id`
- `GET/POST /api/steadfast-config` - Get/save Steadfast API configuration
- `GET /api/courier-sales` - Get all sales sent to courier
- `POST /api/steadfast/send/:id` - Send sale to Steadfast courier (uses DB config, accepts optional body.amount override)
- `DELETE /api/steadfast/order/:id` - Delete pending courier order (restores stock, only pending status allowed)
- `POST /api/steadfast/status/:id` - Check/refresh courier delivery status; marks paidAmount on delivered
- Supplier routes still exist but hidden from UI

## Design Decisions
- Products have unique productCode for barcode/QR scanning; required when creating new products
- Sales support barcode scanning input (Enter key trigger) plus manual product selection dropdown
- Sales support auto customer creation: existing customer selection, new customer with optional save-to-list, or no customer
- Sales use `sale_items` table for multi-product invoices; old data migrated
- All stock/due operations use database transactions for atomicity
- Payment deletion atomically restores customer due amount
- Permanent investments are excluded from working capital and expense calculations
- Daily/monthly stats calculated by filtering sales/expenses by date range
- Suppliers table preserved in DB but removed from sidebar navigation
- Steadfast Courier: API credentials stored in `steadfast_config` DB table (configurable from UI); default base URL https://portal.packzy.com/api/v1; when delivered, sale's paidAmount set to totalPrice (adds to Cash In Hand); status badges: pending=yellow, delivered=green, cancelled/returned=red
- `server/steadfast.ts` - Steadfast API client (createSteadfastOrder, checkSteadfastStatus) — takes config object, uses native fetch, no env vars
- `client/src/pages/steadfast.tsx` - Steadfast courier management page with Settings UI, send orders, track status
