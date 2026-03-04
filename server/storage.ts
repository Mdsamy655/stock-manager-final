import { eq, desc, sql, gte, and } from "drizzle-orm";
import { db, pool } from "./db";
import {
  users,
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
  type User,
  type InsertUser,
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
  userId: number;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  paidAmount: number;
  dueAmount: number;
  totalAmount: number;
  totalWeight: number;
  codFee: number;
  deliveryCharge?: number;
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
  getUser(id: number): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProducts(userId: number): Promise<Product[]>;
  getProduct(id: number, userId: number): Promise<Product | undefined>;
  getProductByCode(code: string, userId: number): Promise<Product | undefined>;
  createProduct(userId: number, product: InsertProduct): Promise<Product>;
  updateProduct(id: number, userId: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  adjustStock(productId: number, userId: number, adjustmentType: string, quantity: number, reason?: string): Promise<StockHistory>;
  getStockHistory(productId: number): Promise<StockHistory[]>;
  deleteProduct(id: number, userId: number): Promise<boolean>;
  updateSaleCourier(id: number, userId: number, consignmentId: string, courierStatus: string): Promise<SaleWithItems | null>;
  cancelCourierOrder(id: number, userId: number): Promise<boolean>;
  getCourierSales(userId: number): Promise<SaleWithItems[]>;

  getSteadfastConfig(userId: number): Promise<SteadfastConfig | null>;
  saveSteadfastConfig(userId: number, apiKey: string, secretKey: string, baseUrl: string): Promise<SteadfastConfig>;

  getSales(userId: number): Promise<SaleWithItems[]>;
  createSale(input: CreateSaleInput): Promise<SaleWithItems>;
  updateSalePayment(id: number, userId: number, paidAmount: number, dueAmount: number): Promise<SaleWithItems | null>;
  deleteSale(id: number, userId: number): Promise<boolean>;

  getExpenses(userId: number): Promise<Expense[]>;
  createExpense(userId: number, expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: number, userId: number): Promise<boolean>;

  getSuppliers(userId: number): Promise<Supplier[]>;
  createSupplier(userId: number, supplier: InsertSupplier): Promise<Supplier>;
  deleteSupplier(id: number, userId: number): Promise<boolean>;

  getPurchases(userId: number): Promise<Purchase[]>;
  createPurchase(userId: number, purchase: InsertPurchase): Promise<Purchase>;
  deletePurchase(id: number, userId: number): Promise<boolean>;

  getCustomers(userId: number): Promise<Customer[]>;
  getCustomer(id: number, userId: number): Promise<Customer | undefined>;
  createCustomer(userId: number, customer: InsertCustomer): Promise<Customer>;
  deleteCustomer(id: number, userId: number): Promise<boolean>;

  getPayments(userId: number): Promise<Payment[]>;
  getPaymentsByCustomer(customerId: number, userId: number): Promise<Payment[]>;
  createPayment(userId: number, customerId: number, amount: number): Promise<Payment>;
  deletePayment(id: number, userId: number): Promise<boolean>;

  getInvestors(userId: number): Promise<Investor[]>;
  createInvestor(userId: number, investor: InsertInvestor): Promise<Investor>;
  deleteInvestor(id: number, userId: number): Promise<boolean>;

  getSalesByCustomer(customerId: number, userId: number): Promise<SaleWithItems[]>;

  getDashboardStats(userId: number): Promise<DashboardStats>;
}

async function attachItemsToSales(salesRows: Sale[]): Promise<SaleWithItems[]> {
  if (salesRows.length === 0) return [];
  const saleIds = salesRows.map(s => s.id);
  const allItems = await db.select().from(saleItems);
  const itemsBySaleId = new Map<number, SaleItem[]>();
  for (const item of allItems) {
    if (!saleIds.includes(item.saleId)) continue;
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
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getProducts(userId: number): Promise<Product[]> {
    return db.select().from(products).where(eq(products.userId, userId)).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number, userId: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.userId, userId)));
    return product;
  }

  async getProductByCode(code: string, userId: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.productCode, code), eq(products.userId, userId)));
    return product;
  }

  async createProduct(userId: number, product: InsertProduct): Promise<Product> {
    if (product.productCode) {
      const existing = await this.getProductByCode(product.productCode, userId);
      if (existing) throw new Error("Product code already exists");
    }
    const [created] = await db.insert(products).values({ ...product, userId }).returning();
    return created;
  }

  async updateProduct(id: number, userId: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    if (product.productCode) {
      const existing = await this.getProductByCode(product.productCode, userId);
      if (existing && existing.id !== id) throw new Error("Product code already exists");
    }
    const [updated] = await db.update(products).set(product).where(and(eq(products.id, id), eq(products.userId, userId))).returning();
    return updated;
  }

  async adjustStock(productId: number, userId: number, adjustmentType: string, quantity: number, reason?: string): Promise<StockHistory> {
    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.userId, userId)));
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

  async deleteProduct(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(products).where(and(eq(products.id, id), eq(products.userId, userId))).returning();
    return result.length > 0;
  }

  async getSales(userId: number): Promise<SaleWithItems[]> {
    const salesRows = await db.select().from(sales).where(eq(sales.userId, userId)).orderBy(desc(sales.createdAt));
    return attachItemsToSales(salesRows);
  }

  async createSale(input: CreateSaleInput): Promise<SaleWithItems> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const item of input.items) {
        const prodResult = await client.query("SELECT * FROM products WHERE id = $1 AND user_id = $2", [item.productId, input.userId]);
        if (prodResult.rows.length === 0) throw new Error(`Product not found: ${item.productName}`);
        const product = prodResult.rows[0];
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${item.productName}`);
        await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.quantity, item.productId]);
      }

      const saleResult = await client.query(
        `INSERT INTO sales (user_id, total_price, customer_id, customer_name, customer_phone, customer_address, paid_amount, due_amount, total_weight, cod_fee, delivery_charge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [input.userId, input.totalAmount, input.customerId || null, input.customerName || null, input.customerPhone || null, input.customerAddress || null, input.paidAmount, input.dueAmount, input.totalWeight, input.codFee, input.deliveryCharge || 0]
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
        userId: saleRow.user_id,
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
        totalWeight: saleRow.total_weight,
        codFee: saleRow.cod_fee,
        deliveryCharge: saleRow.delivery_charge,
        courierStatus: saleRow.courier_status,
        consignmentId: saleRow.consignment_id,
        isSentToCourier: saleRow.is_sent_to_courier,
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

  async deleteSale(id: number, userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 AND user_id = $2", [id, userId]);
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

  async updateSaleCourier(id: number, userId: number, consignmentId: string, courierStatus: string): Promise<SaleWithItems | null> {
    await db.update(sales).set({
      consignmentId,
      courierStatus,
      isSentToCourier: true,
    }).where(and(eq(sales.id, id), eq(sales.userId, userId)));
    const allSales = await db.select().from(sales).where(and(eq(sales.id, id), eq(sales.userId, userId)));
    if (allSales.length === 0) return null;
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
    return { ...allSales[0], items };
  }

  async cancelCourierOrder(id: number, userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 AND user_id = $2", [id, userId]);
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

  async getCourierSales(userId: number): Promise<SaleWithItems[]> {
    const courierSales = await db.select().from(sales).where(and(eq(sales.isSentToCourier, true), eq(sales.userId, userId))).orderBy(desc(sales.createdAt));
    return attachItemsToSales(courierSales);
  }

  async getSteadfastConfig(userId: number): Promise<SteadfastConfig | null> {
    const rows = await db.select().from(steadfastConfig).where(eq(steadfastConfig.userId, userId)).orderBy(desc(steadfastConfig.id)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }

  async saveSteadfastConfig(userId: number, apiKey: string, secretKey: string, baseUrl: string): Promise<SteadfastConfig> {
    await db.delete(steadfastConfig).where(eq(steadfastConfig.userId, userId));
    const result = await db.insert(steadfastConfig).values({ userId, apiKey, secretKey, baseUrl }).returning();
    return result[0];
  }

  async updateSalePayment(id: number, userId: number, paidAmount: number, dueAmount: number): Promise<SaleWithItems | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 AND user_id = $2", [id, userId]);
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
        userId: row.user_id,
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
        courierStatus: row.courier_status,
        consignmentId: row.consignment_id,
        isSentToCourier: row.is_sent_to_courier,
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

  async getExpenses(userId: number): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.createdAt));
  }

  async createExpense(userId: number, expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values({ ...expense, userId }).returning();
    return created;
  }

  async deleteExpense(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).returning();
    return result.length > 0;
  }

  async getSuppliers(userId: number): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.userId, userId)).orderBy(desc(suppliers.createdAt));
  }

  async createSupplier(userId: number, supplier: InsertSupplier): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values({ ...supplier, userId }).returning();
    return created;
  }

  async deleteSupplier(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.userId, userId))).returning();
    return result.length > 0;
  }

  async getPurchases(userId: number): Promise<Purchase[]> {
    return db.select().from(purchases).where(eq(purchases.userId, userId)).orderBy(desc(purchases.createdAt));
  }

  async createPurchase(userId: number, purchase: InsertPurchase): Promise<Purchase> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const txDb = drizzle(client);

      const [product] = await txDb.select().from(products).where(and(eq(products.id, purchase.productId), eq(products.userId, userId)));
      if (!product) throw new Error("Product not found");

      await txDb.update(products).set({ stock: product.stock + purchase.quantity }).where(eq(products.id, purchase.productId));
      const [created] = await txDb.insert(purchases).values({ ...purchase, userId }).returning();

      await client.query("COMMIT");
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePurchase(id: number, userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query("SELECT * FROM purchases WHERE id = $1 AND user_id = $2", [id, userId]);
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

  async getCustomers(userId: number): Promise<Customer[]> {
    return db.select().from(customers).where(eq(customers.userId, userId)).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number, userId: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.userId, userId)));
    return customer;
  }

  async createCustomer(userId: number, customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values({ ...customer, userId }).returning();
    return created;
  }

  async deleteCustomer(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(customers).where(and(eq(customers.id, id), eq(customers.userId, userId))).returning();
    return result.length > 0;
  }

  async getPayments(userId: number): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByCustomer(customerId: number, userId: number): Promise<Payment[]> {
    return db.select().from(payments).where(and(eq(payments.customerId, customerId), eq(payments.userId, userId))).orderBy(desc(payments.createdAt));
  }

  async createPayment(userId: number, customerId: number, amount: number): Promise<Payment> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const custResult = await client.query("SELECT * FROM customers WHERE id = $1 AND user_id = $2", [customerId, userId]);
      if (custResult.rows.length === 0) throw new Error("Customer not found");
      const customer = custResult.rows[0];

      if (amount > customer.due_amount) throw new Error("Payment amount exceeds due amount");

      await client.query(
        "UPDATE customers SET due_amount = due_amount - $1 WHERE id = $2",
        [amount, customerId]
      );

      const payResult = await client.query(
        "INSERT INTO payments (user_id, customer_id, customer_name, amount) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, customerId, customer.name, amount]
      );

      await client.query("COMMIT");

      const row = payResult.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
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

  async deletePayment(id: number, userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const payResult = await client.query("SELECT * FROM payments WHERE id = $1 AND user_id = $2", [id, userId]);
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

  async getInvestors(userId: number): Promise<Investor[]> {
    return db.select().from(investors).where(eq(investors.userId, userId)).orderBy(desc(investors.createdAt));
  }

  async createInvestor(userId: number, investor: InsertInvestor): Promise<Investor> {
    const [created] = await db.insert(investors).values({ ...investor, userId }).returning();
    return created;
  }

  async deleteInvestor(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(investors).where(and(eq(investors.id, id), eq(investors.userId, userId))).returning();
    return result.length > 0;
  }

  async getSalesByCustomer(customerId: number, userId: number): Promise<SaleWithItems[]> {
    const salesRows = await db.select().from(sales).where(and(eq(sales.customerId, customerId), eq(sales.userId, userId))).orderBy(desc(sales.createdAt));
    return attachItemsToSales(salesRows);
  }

  async getDashboardStats(userId: number): Promise<DashboardStats> {
    const allProducts = await db.select().from(products).where(eq(products.userId, userId));
    const allSales = await db.select().from(sales).where(eq(sales.userId, userId));
    const saleIds = allSales.map(s => s.id);
    const allItems = saleIds.length > 0 ? (await db.select().from(saleItems)).filter(i => saleIds.includes(i.saleId)) : [];
    const allExpenses = await db.select().from(expenses).where(eq(expenses.userId, userId));
    const allInvestors = await db.select().from(investors).where(eq(investors.userId, userId));

    const RETURNED_STATUSES = ["returned", "cancelled", "cancelled_delivery"];
    const activeSales = allSales.filter(s => !RETURNED_STATUSES.includes(s.courierStatus || ""));
    const activeSaleIds = new Set(activeSales.map(s => s.id));
    const totalSales = activeSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const itemSaleIds = new Set(allItems.map((i) => i.saleId));
    const activeItems = allItems.filter(i => activeSaleIds.has(i.saleId));
    const totalCostOfSold = activeItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0) +
      activeSales.filter((s) => !itemSaleIds.has(s.id) && s.costPrice && s.quantity)
        .reduce((sum, s) => sum + (s.costPrice! * s.quantity!), 0);
    const currentStockValue = allProducts.reduce(
      (sum, p) => sum + p.costPrice * p.stock,
      0
    );
    const normalExpenses = allExpenses.filter((e) => e.category !== "Permanent Asset");
    const totalExpenses = normalExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPermanentAssets = allExpenses.filter((e) => e.category === "Permanent Asset").reduce((sum, e) => sum + e.amount, 0);
    const totalProfit = totalSales - totalCostOfSold;
    const totalProducts = allProducts.length;
    const lowStockProducts = allProducts.filter((p) => p.stock <= 5).length;

    const totalInvestment = allInvestors.reduce((sum, i) => sum + i.investedAmount, 0);
    const cashInHand = totalInvestment - currentStockValue - totalExpenses;
    const availableWorkingCapital = cashInHand + currentStockValue;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todaySalesRows = activeSales.filter((s) => s.createdAt && new Date(s.createdAt) >= todayStart);
    const monthSalesRows = activeSales.filter((s) => s.createdAt && new Date(s.createdAt) >= monthStart);

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

    const todayProfit = todaySales - todayCost;
    const monthProfit = monthSales - monthCost;

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
