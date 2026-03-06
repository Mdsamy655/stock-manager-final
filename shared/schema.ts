import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"),
  googleId: text("google_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  productCode: text("product_code").notNull().default(""),
  costPrice: real("cost_price").notNull(),
  salePrice: real("sale_price").notNull(),
  stock: integer("stock").notNull().default(0),
  weightPerUnit: real("weight_per_unit").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id"),
  productName: text("product_name"),
  quantity: integer("quantity"),
  unitPrice: real("unit_price"),
  totalPrice: real("total_price").notNull(),
  costPrice: real("cost_price"),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  paidAmount: real("paid_amount").notNull().default(0),
  dueAmount: real("due_amount").notNull().default(0),
  totalWeight: real("total_weight").notNull().default(0),
  codFee: real("cod_fee").notNull().default(0),
  deliveryCharge: real("delivery_charge").notNull().default(0),
  courierStatus: text("courier_status"),
  consignmentId: text("consignment_id"),
  trackingCode: text("tracking_code"),
  isSentToCourier: boolean("is_sent_to_courier").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  costPrice: real("cost_price").notNull(),
  totalPrice: real("total_price").notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  dueAmount: real("due_amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name"),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  totalCost: real("total_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  dueAmount: real("due_amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  amount: real("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  investedAmount: real("invested_amount").notNull(),
  investmentType: text("investment_type").notNull(),
  productId: integer("product_id"),
  isPermanent: boolean("is_permanent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockHistory = pgTable("stock_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  changeAmount: integer("change_amount").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactionHistory = pgTable("transaction_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: timestamp("date").defaultNow(),
  actionType: text("action_type").notNull(),
  reference: text("reference").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull().default(0),
});

export const steadfastConfig = pgTable("steadfast_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  apiKey: text("api_key").notNull(),
  secretKey: text("secret_key").notNull(),
  baseUrl: text("base_url").notNull().default("https://portal.packzy.com/api/v1"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
});
export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertTransactionHistorySchema = createInsertSchema(transactionHistory).omit({
  id: true,
  date: true,
  userId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertInvestor = z.infer<typeof insertInvestorSchema>;
export type Investor = typeof investors.$inferSelect;
export type StockHistory = typeof stockHistory.$inferSelect;
export type SteadfastConfig = typeof steadfastConfig.$inferSelect;
export type InsertTransactionHistory = z.infer<typeof insertTransactionHistorySchema>;
export type TransactionHistory = typeof transactionHistory.$inferSelect;

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface DashboardStats {
  totalSales: number;
  totalInvestment: number;
  currentStockValue: number;
  totalExpenses: number;
  otherExpenses: number;
  courierExpenses: number;
  totalPermanentAssets: number;
  totalProfit: number;
  totalProducts: number;
  lowStockProducts: number;
  availableWorkingCapital: number;
  todaySales: number;
  todayProfit: number;
  monthSales: number;
  monthProfit: number;
  cashInHand: number;
}
