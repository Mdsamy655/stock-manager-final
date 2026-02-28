import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShoppingCart, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { Payment, Customer, SaleWithItems } from "@shared/schema";

interface CustomerDetailsData {
  customer: Customer;
  sales: SaleWithItems[];
  payments: Payment[];
  totalSales: number;
  totalPaid: number;
  currentDue: number;
}

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomerDetails() {
  const [, params] = useRoute("/customers/:id");
  const customerId = params?.id;

  const { data, isLoading } = useQuery<CustomerDetailsData>({
    queryKey: ["/api/customers", customerId],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Customer not found.</p>
        <Link href="/customers">
          <Button variant="ghost" className="mt-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  const { customer, sales, payments: paymentsList, totalSales, totalPaid, currentDue } = data;

  const transactions: Array<{
    type: "sale" | "payment";
    description: string;
    amount: number;
    date: string | Date | null;
  }> = [
    ...sales.map((s) => ({
      type: "sale" as const,
      description: s.items.map((item) => `${item.quantity}x ${item.productName}`).join(", "),
      amount: s.totalPrice,
      date: s.createdAt,
    })),
    ...paymentsList.map((p) => ({
      type: "payment" as const,
      description: "Payment received",
      amount: p.amount,
      date: p.createdAt,
    })),
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-customer-name">{customer.name}</h1>
          <p className="text-muted-foreground text-sm">
            {customer.phone && <span>{customer.phone}</span>}
            {customer.phone && customer.address && <span> · </span>}
            {customer.address && <span>{customer.address}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-sales">{formatTaka(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-total-paid">{formatTaka(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current Due</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${currentDue > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-current-due">
              {formatTaka(currentDue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, i) => (
                    <TableRow key={i} data-testid={`row-transaction-${i}`}>
                      <TableCell>
                        {tx.type === "sale" ? (
                          <Badge variant="secondary" className="gap-1">
                            <ShoppingCart className="h-3 w-3" /> Sale
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1 bg-emerald-600">
                            <Banknote className="h-3 w-3" /> Payment
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === "payment" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {tx.type === "payment" ? "+" : ""}{formatTaka(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDate(tx.date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No transactions yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
