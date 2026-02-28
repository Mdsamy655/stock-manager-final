import { eq, desc, sql, gte, and } from "drizzle-orm";
import { db, pool } from "./db";
import {
  products,
  sales,
  saleItems,
  expenses,
  suppliers,
  purchases,
  customers,
  payments,
  investors,
  steadfastConfig,
  type Product,
  type InsertProduct,
  type Sale,
  type InsertSale,
  type SaleItem,
  type SaleWithItems,
  type Expense,
  type InsertExpense,
  type Supplier,
  type InsertSupplier,
  type Purchase,
  type InsertPurchase,
  type Customer,
  type InsertCustomer,
  type Payment,
  type InsertPayment,
  type Investor,
  type InsertInvestor,
  type DashboardStats,
  stockHistory,
  type StockHistory,
  type SteadfastConfig,
} from "@shared/schema";

interface CreateSaleInput {
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  paidAmount: number;
  dueAmount: number;
  totalAmount: number;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    totalPrice: number;
  }>;
}

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByCode(code: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  adjustStock(productId: number, adjustmentType: string, quantity: number, reason?: string): Promise<StockHistory>;
  getStockHistory(productId: number): Promise<StockHistory[]>;
  deleteProduct(id: number): Promise<boolean>;
  updateSaleCourier(id: number, consignmentId: string, courierStatus: string): Promise<SaleWithItems | null>;
  cancelCourierOrder(id: number): Promise<boolean>;
  getCourierSales(): Promise<SaleWithItems[]>;

  getSteadfastConfig(): Promise<SteadfastConfig | null>;
  saveSteadfastConfig(apiKey: string, secretKey: string, baseUrl: string): Promise<SteadfastConfig>;

  getSales(): Promise<SaleWithItems[]>;
  createSale(input: CreateSaleInput): Promise<SaleWithItems>;
  updateSalePayment(id: number, paidAmount: number, dueAmount: number): Promise<SaleWithItems | null>;
  deleteSale(id: number): Promise<boolean>;

  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: number): Promise<boolean>;

  getSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  deleteSupplier(id: number): Promise<boolean>;

  getPurchases(): Promise<Purchase[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  deletePurchase(id: number): Promise<boolean>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  deleteCustomer(id: number): Promise<boolean>;

  getPayments(): Promise<Payment[]>;
  getPaymentsByCustomer(customerId: number): Promise<Payment[]>;
  createPayment(customerId: number, amount: number): Promise<Payment>;
  deletePayment(id: number): Promise<boolean>;

  getInvestors(): Promise<Investor[]>;
  createInvestor(investor: InsertInvestor): Promise<Investor>;
  deleteInvestor(id: number): Promise<boolean>;

  getSalesByCustomer(customerId: number): Promise<SaleWithItems[]>;

  getDashboardStats(): Promise<DashboardStats>;
}

async function attachItemsToSales(salesRows: Sale[]): Promise<SaleWithItems[]> {
  if (salesRows.length === 0) return [];
  const allItems = await db.select().from(saleItems);
  const itemsBySaleId = new Map<number, SaleItem[]>();
  for (const item of allItems) {
    const list = itemsBySaleId.get(item.saleId) || [];
    list.push(item);
    itemsBySaleId.set(item.saleId, list);
  }
  return salesRows.map((sale) => {
    let items = itemsBySaleId.get(sale.id) || [];
    if (items.length === 0 && sale.productId && sale.productName && sale.quantity && sale.unitPrice && sale.costPrice) {
      items = [{
        id: 0,
        saleId: sale.id,
        productId: sale.productId,
        productName: sale.productName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        costPrice: sale.costPrice,
        totalPrice: sale.totalPrice,
      }];
    }
    return { ...sale, items };
  });
}

export class DatabaseStorage implements IStorage {
  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByCode(code: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.productCode, code));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    if (product.productCode) {
      const existing = await this.getProductByCode(product.productCode);
      if (existing) throw new Error("Product code already exists");
    }
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    if (product.productCode) {
      const existing = await this.getProductByCode(product.productCode);
      if (existing && existing.id !== id) throw new Error("Product code already exists");
    }
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async adjustStock(productId: number, adjustmentType: string, quantity: number, reason?: string): Promise<StockHistory> {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) throw new Error("Product not found");

    const previousStock = product.stock;
    let newStock: number;

    if (adjustmentType === "add") {
      newStock = previousStock + quantity;
    } else if (adjustmentType === "reduce") {
      newStock = previousStock - quantity;
    } else if (adjustmentType === "set") {
      newStock = quantity;
    } else {
      throw new Error("Invalid adjustment type");
    }

    if (newStock < 0) throw new Error("Stock cannot be negative");

    const changeAmount = newStock - previousStock;

    await db.update(products).set({ stock: newStock }).where(eq(products.id, productId));

    const [record] = await db.insert(stockHistory).values({
      productId,
      previousStock,
      newStock,
      changeAmount,
      reason: reason || null,
    }).returning();

    return record;
  }

  async getStockHistory(productId: number): Promise<StockHistory[]> {
    return db.select().from(stockHistory).where(eq(stockHistory.productId, productId)).orderBy(desc(stockHistory.createdAt));
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  async getSales(): Promise<SaleWithItems[]> {
    const salesRows = await db.select().from(sales).orderBy(desc(sales.createdAt));
    return attachItemsToSales(salesRows);
  }

  async createSale(input: CreateSaleInput): Promise<SaleWithItems> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const item of input.items) {
        const prodResult = await client.query("SELECT * FROM products WHERE id = $1", [item.productId]);
        if (prodResult.rows.length === 0) throw new Error(`Product not found: ${item.productName}`);
        const product = prodResult.rows[0];
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${item.productName}`);
        await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.quantity, item.productId]);
      }

      const saleResult = await client.query(
        `INSERT INTO sales (total_price, customer_id, customer_name, customer_phone, customer_address, paid_amount, due_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [input.totalAmount, input.customerId || null, input.customerName || null, input.customerPhone || null, input.customerAddress || null, input.paidAmount, input.dueAmount]
      );
      const saleRow = saleResult.rows[0];
      const saleId = saleRow.id;

      const insertedItems: SaleItem[] = [];
      for (const item of input.items) {
        const itemResult = await client.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, cost_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.costPrice, item.totalPrice]
        );
        const row = itemResult.rows[0];
        insertedItems.push({
          id: row.id,
          saleId: row.sale_id,
          productId: row.product_id,
          productName: row.product_name,
          quantity: row.quantity,
          unitPrice: row.unit_price,
          costPrice: row.cost_price,
          totalPrice: row.total_price,
        });
      }

      if (input.dueAmount > 0 && input.customerId) {
        await client.query("UPDATE customers SET due_amount = due_amount + $1 WHERE id = $2", [input.dueAmount, input.customerId]);
      }

      await client.query("COMMIT");

      return {
        id: saleRow.id,
        productId: saleRow.product_id,
        productName: saleRow.product_name,
        quantity: saleRow.quantity,
        unitPrice: saleRow.unit_price,
        totalPrice: saleRow.total_price,
        costPrice: saleRow.cost_price,
        customerId: saleRow.customer_id,
        customerName: saleRow.customer_name,
        customerPhone: saleRow.customer_phone,
        customerAddress: saleRow.customer_address,
        paidAmount: saleRow.paid_amount,
        dueAmount: saleRow.due_amount,
        createdAt: saleRow.created_at,
        items: insertedItems,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteSale(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query("SELECT * FROM sales WHERE id = $1", [id]);
      if (saleResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const sale = saleResult.rows[0];

      const itemsResult = await client.query("SELECT * FROM sale_items WHERE sale_id = $1", [id]);
      if (itemsResult.rows.length > 0) {
        for (const item of itemsResult.rows) {
          await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [item.quantity, item.product_id]
          );
        }
      } else if (sale.product_id && sale.quantity) {
        await client.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [sale.quantity, sale.product_id]
        );
      }

      if (sale.due_amount > 0 && sale.customer_id) {
        await client.query(
          "UPDATE customers SET due_amount = GREATEST(0, due_amount - $1) WHERE id = $2",
          [sale.due_amount, sale.customer_id]
        );
      }

      await client.query("DELETE FROM sale_items WHERE sale_id = $1", [id]);
      await client.query("DELETE FROM sales WHERE id = $1", [id]);

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateSaleCourier(id: number, consignmentId: string, courierStatus: string): Promise<SaleWithItems | null> {
    await db.update(sales).set({
      consignmentId,
      courierStatus,
      isSentToCourier: true,
    }).where(eq(sales.id, id));
    const allSales = await db.select().from(sales).where(eq(sales.id, id));
    if (allSales.length === 0) return null;
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
    return { ...allSales[0], items };
  }

  async cancelCourierOrder(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query("SELECT * FROM sales WHERE id = $1", [id]);
      if (saleResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const sale = saleResult.rows[0];

      if (!sale.is_sent_to_courier) {
        await client.query("ROLLBACK");
        return false;
      }

      const itemsResult = await client.query("SELECT * FROM sale_items WHERE sale_id = $1", [id]);
      if (itemsResult.rows.length > 0) {
        for (const item of itemsResult.rows) {
          await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [item.quantity, item.product_id]
          );
        }
      } else if (sale.product_id && sale.quantity) {
        await client.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [sale.quantity, sale.product_id]
        );
      }

      await client.query(
        "UPDATE sales SET is_sent_to_courier = false, courier_status = NULL, consignment_id = NULL WHERE id = $1",
        [id]
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getCourierSales(): Promise<SaleWithItems[]> {
    const courierSales = await db.select().from(sales).where(eq(sales.isSentToCourier, true)).orderBy(desc(sales.createdAt));
    return attachItemsToSales(courierSales);
  }

  async getSteadfastConfig(): Promise<SteadfastConfig | null> {
    const rows = await db.select().from(steadfastConfig).orderBy(desc(steadfastConfig.id)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }

  async saveSteadfastConfig(apiKey: string, secretKey: string, baseUrl: string): Promise<SteadfastConfig> {
    await db.delete(steadfastConfig);
    const result = await db.insert(steadfastConfig).values({ apiKey, secretKey, baseUrl }).returning();
    return result[0];
  }

  async updateSalePayment(id: number, paidAmount: number, dueAmount: number): Promise<SaleWithItems | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query("SELECT * FROM sales WHERE id = $1", [id]);
      if (saleResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const sale = saleResult.rows[0];
      const oldDue = sale.due_amount || 0;
      const newDue = dueAmount;
      const dueDiff = newDue - oldDue;

      if (sale.customer_id && dueDiff !== 0) {
        await client.query(
          "UPDATE customers SET due_amount = GREATEST(0, due_amount + $1) WHERE id = $2",
          [dueDiff, sale.customer_id]
        );
      }

      await client.query(
        "UPDATE sales SET paid_amount = $1, due_amount = $2 WHERE id = $3",
        [paidAmount, dueAmount, id]
      );

      await client.query("COMMIT");

      const updatedResult = await client.query("SELECT * FROM sales WHERE id = $1", [id]);
      const row = updatedResult.rows[0];
      const itemsResult = await client.query("SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id", [id]);
      const items: SaleItem[] = itemsResult.rows.map((r: any) => ({
        id: r.id,
        saleId: r.sale_id,
        productId: r.product_id,
        productName: r.product_name,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        costPrice: r.cost_price,
        totalPrice: r.total_price,
      }));

      return {
        id: row.id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        totalPrice: row.total_price,
        costPrice: row.cost_price,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerAddress: row.customer_address,
        paidAmount: row.paid_amount,
        dueAmount: row.due_amount,
        createdAt: row.created_at,
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getExpenses(): Promise<Expense[]> {
    return db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning();
    return result.length > 0;
  }

  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    return result.length > 0;
  }

  async getPurchases(): Promise<Purchase[]> {
    return db.select().from(purchases).orderBy(desc(purchases.createdAt));
  }

  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const txDb = drizzle(client);

      const [product] = await txDb.select().from(products).where(eq(products.id, purchase.productId));
      if (!product) throw new Error("Product not found");

      await txDb.update(products).set({ stock: product.stock + purchase.quantity }).where(eq(products.id, purchase.productId));
      const [created] = await txDb.insert(purchases).values(purchase).returning();

      await client.query("COMMIT");
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePurchase(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query("SELECT * FROM purchases WHERE id = $1", [id]);
      if (purchaseResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const purchase = purchaseResult.rows[0];

      const productResult = await client.query("SELECT * FROM products WHERE id = $1", [purchase.product_id]);
      if (productResult.rows.length > 0) {
        const currentStock = productResult.rows[0].stock;
        if (currentStock < purchase.quantity) {
          await client.query("ROLLBACK");
          throw new Error(`Cannot delete: would reduce stock below zero (current stock: ${currentStock}, purchase qty: ${purchase.quantity})`);
        }
        await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [purchase.quantity, purchase.product_id]);
      }

      await client.query("DELETE FROM purchases WHERE id = $1", [id]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  async getPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByCustomer(customerId: number): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.customerId, customerId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(customerId: number, amount: number): Promise<Payment> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const custResult = await client.query("SELECT * FROM customers WHERE id = $1", [customerId]);
      if (custResult.rows.length === 0) throw new Error("Customer not found");
      const customer = custResult.rows[0];

      if (amount > customer.due_amount) throw new Error("Payment amount exceeds due amount");

      await client.query(
        "UPDATE customers SET due_amount = due_amount - $1 WHERE id = $2",
        [amount, customerId]
      );

      const payResult = await client.query(
        "INSERT INTO payments (customer_id, customer_name, amount) VALUES ($1, $2, $3) RETURNING *",
        [customerId, customer.name, amount]
      );

      await client.query("COMMIT");

      const row = payResult.rows[0];
      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        amount: row.amount,
        createdAt: row.created_at,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePayment(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const payResult = await client.query("SELECT * FROM payments WHERE id = $1", [id]);
      if (payResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const payment = payResult.rows[0];

      await client.query(
        "UPDATE customers SET due_amount = due_amount + $1 WHERE id = $2",
        [payment.amount, payment.customer_id]
      );

      await client.query("DELETE FROM payments WHERE id = $1", [id]);

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getInvestors(): Promise<Investor[]> {
    return db.select().from(investors).orderBy(desc(investors.createdAt));
  }

  async createInvestor(investor: InsertInvestor): Promise<Investor> {
    const [created] = await db.insert(investors).values(investor).returning();
    return created;
  }

  async deleteInvestor(id: number): Promise<boolean> {
    const result = await db.delete(investors).where(eq(investors.id, id)).returning();
    return result.length > 0;
  }

  async getSalesByCustomer(customerId: number): Promise<SaleWithItems[]> {
    const salesRows = await db.select().from(sales).where(eq(sales.customerId, customerId)).orderBy(desc(sales.createdAt));
    return attachItemsToSales(salesRows);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const allProducts = await db.select().from(products);
    const allSales = await db.select().from(sales);
    const allItems = await db.select().from(saleItems);
    const allExpenses = await db.select().from(expenses);
    const allInvestors = await db.select().from(investors);

    const totalSales = allSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const itemSaleIds = new Set(allItems.map((i) => i.saleId));
    const totalCostOfSold = allItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0) +
      allSales.filter((s) => !itemSaleIds.has(s.id) && s.costPrice && s.quantity)
        .reduce((sum, s) => sum + (s.costPrice! * s.quantity!), 0);
    const totalInvestment = allProducts.reduce((sum, p) => sum + p.costPrice * p.stock, 0) + totalCostOfSold;
    const currentStockValue = allProducts.reduce((sum, p) => sum + p.salePrice * p.stock, 0);
    const normalExpenses = allExpenses.filter((e) => e.category !== "Permanent Asset");
    const totalExpenses = normalExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPermanentAssets = allExpenses.filter((e) => e.category === "Permanent Asset").reduce((sum, e) => sum + e.amount, 0);
    const totalProfit = totalSales - totalCostOfSold - totalExpenses;
    const totalProducts = allProducts.length;
    const lowStockProducts = allProducts.filter((p) => p.stock <= 5).length;

    const totalAllInvestment = allInvestors.reduce((sum, i) => sum + i.investedAmount, 0);
    const availableWorkingCapital = totalAllInvestment - totalExpenses;

    const allPurchases = await db.select().from(purchases);
    const totalPaidFromSales = allSales.reduce((sum, s) => sum + (s.paidAmount ?? s.totalPrice), 0);
    const cashInvestorAmount = allInvestors
      .filter((i) => i.investmentType === "cash")
      .reduce((sum, i) => sum + i.investedAmount, 0);
    const totalPurchaseCost = allPurchases.reduce((sum, p) => sum + p.totalCost, 0);
    const totalAllExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const cashInHand = totalPaidFromSales + cashInvestorAmount - totalAllExpenses - totalPurchaseCost;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todaySalesRows = allSales.filter((s) => s.createdAt && new Date(s.createdAt) >= todayStart);
    const monthSalesRows = allSales.filter((s) => s.createdAt && new Date(s.createdAt) >= monthStart);

    const todaySales = todaySalesRows.reduce((sum, s) => sum + s.totalPrice, 0);
    const monthSales = monthSalesRows.reduce((sum, s) => sum + s.totalPrice, 0);

    const todaySaleIds = new Set(todaySalesRows.map((s) => s.id));
    const monthSaleIds = new Set(monthSalesRows.map((s) => s.id));

    const todayCost = allItems.filter((i) => todaySaleIds.has(i.saleId)).reduce((sum, i) => sum + i.costPrice * i.quantity, 0) +
      todaySalesRows.filter((s) => !itemSaleIds.has(s.id) && s.costPrice && s.quantity)
        .reduce((sum, s) => sum + (s.costPrice! * s.quantity!), 0);

    const monthCost = allItems.filter((i) => monthSaleIds.has(i.saleId)).reduce((sum, i) => sum + i.costPrice * i.quantity, 0) +
      monthSalesRows.filter((s) => !itemSaleIds.has(s.id) && s.costPrice && s.quantity)
        .reduce((sum, s) => sum + (s.costPrice! * s.quantity!), 0);

    const todayExpenses = normalExpenses.filter((e) => e.createdAt && new Date(e.createdAt) >= todayStart).reduce((sum, e) => sum + e.amount, 0);
    const monthExpenses = normalExpenses.filter((e) => e.createdAt && new Date(e.createdAt) >= monthStart).reduce((sum, e) => sum + e.amount, 0);

    const todayProfit = todaySales - todayCost - todayExpenses;
    const monthProfit = monthSales - monthCost - monthExpenses;

    return {
      totalSales,
      totalInvestment,
      currentStockValue,
      totalExpenses,
      totalPermanentAssets,
      totalProfit,
      totalProducts,
      lowStockProducts,
      availableWorkingCapital,
      todaySales,
      todayProfit,
      monthSales,
      monthProfit,
      cashInHand,
    };
  }
}

export const storage = new DatabaseStorage();
