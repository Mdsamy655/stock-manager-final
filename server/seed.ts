import { db } from "./db";
import { products, sales, expenses } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingProducts = await db.select().from(products);
  if (existingProducts.length > 0) return;

  const seedProducts = [
    { name: "Basmati Rice (5kg)", costPrice: 450, salePrice: 550, stock: 45 },
    { name: "Mustard Oil (1L)", costPrice: 180, salePrice: 220, stock: 30 },
    { name: "Sugar (1kg)", costPrice: 85, salePrice: 110, stock: 60 },
    { name: "Red Lentils (1kg)", costPrice: 120, salePrice: 155, stock: 40 },
    { name: "Turmeric Powder (200g)", costPrice: 65, salePrice: 90, stock: 25 },
    { name: "Onion (1kg)", costPrice: 40, salePrice: 60, stock: 100 },
    { name: "Flour (2kg)", costPrice: 95, salePrice: 130, stock: 35 },
    { name: "Tea Leaves (400g)", costPrice: 250, salePrice: 320, stock: 20 },
  ];

  const insertedProducts = await db.insert(products).values(seedProducts).returning();

  const seedSales = [
    { productId: insertedProducts[0].id, productName: "Basmati Rice (5kg)", quantity: 5, unitPrice: 550, totalPrice: 2750, costPrice: 450 },
    { productId: insertedProducts[1].id, productName: "Mustard Oil (1L)", quantity: 3, unitPrice: 220, totalPrice: 660, costPrice: 180 },
    { productId: insertedProducts[2].id, productName: "Sugar (1kg)", quantity: 10, unitPrice: 110, totalPrice: 1100, costPrice: 85 },
    { productId: insertedProducts[5].id, productName: "Onion (1kg)", quantity: 8, unitPrice: 60, totalPrice: 480, costPrice: 40 },
    { productId: insertedProducts[7].id, productName: "Tea Leaves (400g)", quantity: 4, unitPrice: 320, totalPrice: 1280, costPrice: 250 },
  ];

  await db.insert(sales).values(seedSales);

  const seedExpenses = [
    { description: "Shop Rent - January", amount: 15000, category: "Rent" },
    { description: "Electricity Bill", amount: 3500, category: "Utilities" },
    { description: "Transport & Delivery", amount: 2000, category: "Transport" },
    { description: "Staff Salary - Karim", amount: 12000, category: "Salary" },
    { description: "Packaging Materials", amount: 1500, category: "Supplies" },
  ];

  await db.insert(expenses).values(seedExpenses);

  console.log("Database seeded successfully");
}
