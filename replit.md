# InventoryPro - Inventory Management System

## Overview
A professional inventory management system built with Node.js, Express, React, and PostgreSQL. Features product management with weight tracking, multi-product invoice sales with 1% COD fee option, expense recording, customer due management, payment tracking, investor management, and a comprehensive dashboard with business analytics. All monetary values are displayed in Bangladeshi Taka (৳).

## Architecture
- **Frontend:** React + TypeScript with Shadcn UI components, TanStack Query, Wouter routing
- **Backend:** Express.js API server
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS with Shadcn design system
- **Auth:** JWT-based authentication with bcrypt password hashing. Login/Register on client/src/pages/login.tsx, AuthProvider in client/src/hooks/use-auth.tsx, middleware in server/auth.ts. Token stored in localStorage, 30-day expiry. All /api routes (except /api/auth/*) require valid Bearer token.

## Key Features
- **Dashboard:** Cash In Hand, Stock Value, Total Sales, Other Expenses (excl. courier), Profit, Investment, Low Stock Alerts, Working Capital, Permanent Assets, Daily & Monthly summaries
- **Products:** Add/delete products with cost price, sale price, stock tracking, weight per unit (KG), manual stock adjustment (Add/Reduce/Set Exact with history logging), and barcode label printing (single or bulk, with configurable options: barcode, product code, name, price, shop name; 60mm×40mm sticker labels)
- **Sales:** Invoice-style multi-product sales with automatic stock reduction per item, editable sale price per line item, optional 1% COD fee toggle, line weight display (quantity × weightPerUnit), total weight calculation, optional customer assignment, partial payment with due tracking
- **Expenses:** Three sections: Courier Expenses (auto-created, category "Delivery"), Other Expenses (manual business costs), Permanent Assets (long-term assets). Dashboard only shows "Other Expenses".
- **Purchases:** Record stock purchases with automatic stock increase. Auto-created when a product is added with initial stock.
- **Customers:** Add/view customers with due amount tracking
- **Payments:** Record/delete customer payments that adjust their due amounts
- **Investors:** Track investor contributions with cash/product types, withdraw from investor balance
- **Steadfast Courier:** Dynamic API config stored in DB; send sales to Steadfast courier with editable COD amount per order; track status; fixed 110 BDT courier charge on send; profit/cash only counted when delivered; stock restored on cancel; cancelled sales zero out payment/due; auto-refresh every 30 minutes with visible timestamp; bulk status check for selected orders; bulk manual status set; Track button opens Steadfast tracking page; Refresh All button for manual instant refresh
- **Customer Details:** View individual customer transaction history
- **Invoice System:** Generate printable/downloadable PDF invoices with COD fee and weight display
- **Database (Activity Log):** Automatic activity recording for Sale, Purchase, Expense, Courier Expense, Return Charge, Investment, Withdrawal, and Payment Received. Single `amount` field per record. Searchable/filterable table with color-coded action type badges. Delete button per record with confirmation dialog. No balance or totals — just a flat activity history.

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
- `transaction_history` - userId, date, actionType, reference, description, amount (Activity log for financial actions)
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
- `client/src/pages/` - Dashboard, Products, Sales, Expenses, Purchases, Customers, CustomerDetails, Payments, Investors, Steadfast, Database pages
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
- `GET/POST /api/investors`, `POST /api/investors/:id/withdraw`, `DELETE /api/investors/:id`
- `GET/POST /api/steadfast-config`
- `GET /api/courier-sales`
- `POST /api/steadfast/send/:id`, `DELETE /api/steadfast/order/:id`, `POST /api/steadfast/status/:id`
- `POST /api/steadfast/manual-status/:id` — manual status update (pending, in_review, delivered, cancelled) with financial/stock effects
- `POST /api/steadfast/bulk-status` — bulk check courier status via API for multiple sale IDs
- `GET /api/transaction-history` - Financial activity records
- `DELETE /api/transaction-history/:id` - Delete individual activity record

## Weight & COD Logic
- **Weight:** Each product has optional `weightPerUnit` (KG). During sales, line weight = quantity × weightPerUnit. Total weight = sum of all line weights. Stored in `sales.total_weight`.
- **COD Fee:** Optional 1% fee on subtotal. Frontend sends `addCodFee: true/false`. Backend recalculates: `codFee = subtotal × 0.01`.
- **Sale Total:** Grand Total = Subtotal + COD Fee + Delivery Charge + Packing Charge. Due = Grand Total - Paid. Backend delivery rates: ≤0.5kg=110, ≤1kg=130, >1kg=130+ceil(weight-1)×20. Packing: >5kg=15, else 10.
- **Courier COD:** Defaults to sale's dueAmount (not totalPrice). COD Amount = Sale Due.
- **Invoice:** Shows Items Total, COD Fee (if any), Subtotal, Delivery Charge, Grand Total, Weight

## Dashboard Financial Formulas
- **Total Profit** = Sum of (unitPrice - costPrice) × quantity per item. Product margin only — delivery/packing excluded. Courier sales only count when delivered.
- **Total Investment** = Sum of all investor contributions only (profit excluded)
- **Stock Value** = Sum of (Cost Price × Current Stock) for all products
- **Cash In Hand** = Total Investment + Total Profit - Other Expenses - Stock Value - Return Charges (courier expenses excluded since delivery is a pass-through; return charges from transaction_history deducted)
- **Working Capital** = Cash In Hand + Stock Value
- **Buying products:** decreases Cash In Hand, increases Stock Value, Total Investment unchanged
- **Expenses:** Other expenses decrease Cash In Hand. Courier expenses (Delivery category) are pass-through costs that don't affect profit or Cash In Hand.
- **Courier charge:** Dynamic amount (= sale.deliveryCharge = delivery + packing) added as Delivery expense when parcel is sent. Not added again on status change.
- **Today/Month Profit** follows same rule: item-level (unitPrice - costPrice) × quantity

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
- Courier labels use JsBarcode (CODE128) for barcodes and qrcode.react for QR codes
- All devDependencies were moved to dependencies to work with NODE_ENV=production in the Replit environment
