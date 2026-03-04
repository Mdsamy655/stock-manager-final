# InventoryPro - Inventory Management System

## Overview
A professional inventory management system built with Node.js, Express, React, and PostgreSQL. Features product management with weight tracking, multi-product invoice sales with 1% COD fee option, expense recording, customer due management, payment tracking, investor management, and a comprehensive dashboard with business analytics. All monetary values are displayed in Bangladeshi Taka (৳).

## Architecture
- **Frontend:** React + TypeScript with Shadcn UI components, TanStack Query, Wouter routing
- **Backend:** Express.js API server
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS with Shadcn design system
- **Auth:** TEMPORARILY DISABLED — middleware bypassed, default user id=4 used for all requests. Auth code preserved in server/auth.ts and client/src/hooks/use-auth.tsx for future re-enablement.

## Key Features
- **Dashboard:** Total Sales, Investment, Stock Value, Expenses, Profit, Cash In Hand, Low Stock Alerts, Working Capital, Daily & Monthly Sales/Profit summaries, COD Summary
- **Products:** Add/delete products with cost price, sale price, stock tracking, weight per unit (KG), and manual stock adjustment (Add/Reduce/Set Exact with history logging)
- **Sales:** Invoice-style multi-product sales with automatic stock reduction per item, editable sale price per line item, optional 1% COD fee toggle, line weight display (quantity × weightPerUnit), total weight calculation, optional customer assignment, partial payment with due tracking
- **Expenses:** Track business expenses with categories; "Permanent Asset" category separated from normal expenses
- **Purchases:** Record stock purchases with automatic stock increase
- **Customers:** Add/view customers with due amount tracking
- **Payments:** Record/delete customer payments that adjust their due amounts
- **Investors:** Track investor contributions with cash/product types
- **Steadfast Courier:** Dynamic API config stored in DB; send sales to Steadfast courier with editable COD amount per order; track status; fixed 110 BDT courier charge on send; profit/cash only counted when delivered; stock restored on cancel; cancelled sales zero out payment/due
- **Customer Details:** View individual customer transaction history
- **Invoice System:** Generate printable/downloadable PDF invoices with COD fee and weight display

## Data Model
- `users` - name, email (unique), password (bcrypt hash), googleId (nullable)
- `products` - userId, name, productCode, costPrice, salePrice, stock, **weightPerUnit** (KG, default 0)
- `stock_history` - productId, previousStock, newStock, changeAmount, reason, createdAt
- `sales` - userId, totalPrice (includes codFee), customerId, customerName, customerPhone, customerAddress, paidAmount, dueAmount, **totalWeight** (KG), **codFee** (1% of subtotal), **deliveryCharge** (delivery+packing, stored for return accounting), courierStatus, consignmentId, isSentToCourier
- `sale_items` - saleId, productId, productName, quantity, unitPrice, costPrice, totalPrice
- `expenses` - userId, description, amount, category
- `suppliers` - userId, name, phone, address, dueAmount
- `purchases` - userId, productId, productName, supplierId, supplierName, quantity, unitCost, totalCost
- `customers` - userId, name, phone, address, dueAmount
- `payments` - userId, customerId, customerName, amount
- `investors` - userId, name, investedAmount, investmentType, productId, isPermanent
- `steadfast_config` - userId, apiKey, secretKey, baseUrl, createdAt

## File Structure
- `shared/schema.ts` - Drizzle schemas, types, DashboardStats interface
- `server/auth.ts` - JWT token generation/verification, auth middleware (CURRENTLY BYPASSED)
- `server/db.ts` - Database connection with pool configuration
- `server/storage.ts` - Data access layer with transactional operations
- `server/routes.ts` - API endpoints
- `server/steadfast.ts` - Steadfast API client
- `client/src/hooks/use-auth.tsx` - Auth context provider (CURRENTLY UNUSED)
- `client/src/pages/auth.tsx` - Login/Register page (CURRENTLY UNUSED)
- `client/src/pages/` - Dashboard, Products, Sales, Expenses, Purchases, Customers, CustomerDetails, Payments, Investors, Steadfast pages
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/invoice-modal.tsx` - Invoice generation modal with COD fee and weight display
- `client/src/lib/queryClient.ts` - API request helpers

## API Endpoints
- `GET /api/dashboard` - Dashboard stats
- `GET/POST /api/products`, `PATCH/DELETE /api/products/:id`
- `GET/POST /api/sales`, `DELETE /api/sales/:id` — POST accepts `addCodFee: boolean` to add 1% COD cost
- `GET/POST /api/expenses`, `DELETE /api/expenses/:id`
- `GET/POST /api/purchases`
- `GET/POST /api/customers`, `GET/DELETE /api/customers/:id`
- `GET/POST /api/payments`, `DELETE /api/payments/:id`
- `GET/POST /api/investors`, `DELETE /api/investors/:id`
- `GET/POST /api/steadfast-config`
- `GET /api/courier-sales`
- `POST /api/steadfast/send/:id`, `DELETE /api/steadfast/order/:id`, `POST /api/steadfast/status/:id`
- `POST /api/steadfast/manual-status/:id` — manual status update (pending, in_review, delivered, cancelled) with financial/stock effects

## Weight & COD Logic
- **Weight:** Each product has optional `weightPerUnit` (KG). During sales, line weight = quantity × weightPerUnit. Total weight = sum of all line weights. Stored in `sales.total_weight`.
- **COD Fee:** Optional 1% fee on subtotal. Frontend sends `addCodFee: true/false`. Backend recalculates: `codFee = subtotal × 0.01`.
- **Sale Total:** Grand Total = Subtotal + COD Fee + Delivery Charge + Packing Charge. Due = Grand Total - Paid. Backend delivery rates: ≤0.5kg=110, ≤1kg=130, >1kg=130+ceil(weight-1)×20. Packing: >5kg=15, else 10.
- **Courier COD:** Defaults to sale's dueAmount (not totalPrice). COD Amount = Sale Due.
- **Invoice:** Shows Items Total, COD Fee (if any), Subtotal, Delivery Charge, Grand Total, Weight

## Dashboard Financial Formulas
- **Total Profit** = Total Sales Revenue - Total Cost of Goods Sold (no expense deduction). Courier sales only count when delivered.
- **Total Investment** = Sum of all investor contributions only (profit excluded)
- **Stock Value** = Sum of (Cost Price × Current Stock) for all products
- **Cash In Hand** = Total Investment + Total Profit - Total Expenses - Stock Value
- **Working Capital** = Cash In Hand + Stock Value
- **Buying products:** decreases Cash In Hand, increases Stock Value, Total Investment unchanged
- **Expenses:** decrease Cash In Hand, increase Total Expenses
- **Courier charge:** Fixed 110 BDT added as Delivery expense when parcel is sent. Not added again on status change.
- **Today/Month Profit** follows same rule: sales revenue minus cost of goods sold (no expense deduction)

## Design Decisions
- All data tables have `user_id` column for multi-user isolation (currently all requests use user id=4)
- Products have unique productCode for barcode/QR scanning
- Sales use `sale_items` table for multi-product invoices
- All stock/due operations use database transactions for atomicity
- Steadfast Courier: API credentials stored per user in DB; auto-sync interval every 30 minutes

## Critical Notes
- AUTH IS TEMPORARILY DISABLED — to re-enable, restore original authMiddleware in server/auth.ts, re-add AuthProvider/AuthenticatedApp in App.tsx
- tsx binary symlink breaks after every npm install. Fix: `ln -sf ../tsx/dist/cli.mjs node_modules/.bin/tsx && chmod +x node_modules/.bin/tsx`
- Never install html2pdf.js — use html2canvas+jspdf instead
- All devDependencies were moved to dependencies to work with NODE_ENV=production in the Replit environment
