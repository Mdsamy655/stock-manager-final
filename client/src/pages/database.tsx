import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Database as DatabaseIcon, Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@shared/schema";
import { format } from "date-fns";

const categoryColors: Record<string, string> = {
  "Sale": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Purchase": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Expense": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Courier Expense": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Return Charge": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Investment": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Withdrawal": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Payment Received": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

type SortField = "date" | "debit" | "credit" | "profit";
type SortDirection = "asc" | "desc";

export default function DatabasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: allTransactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const filteredTransactions = (allTransactions || [])
    .filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          t.description.toLowerCase().includes(query) ||
          t.source.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = new Date(a.date!).getTime() - new Date(b.date!).getTime();
      } else {
        comparison = (a[sortField] ?? 0) - (b[sortField] ?? 0);
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });

  const totals = filteredTransactions.reduce(
    (acc, t) => ({
      debit: acc.debit + (t.debit ?? 0),
      credit: acc.credit + (t.credit ?? 0),
      profit: acc.profit + (t.profit ?? 0),
    }),
    { debit: 0, credit: 0, profit: 0 }
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const categories = [
    "Sale",
    "Purchase",
    "Expense",
    "Courier Expense",
    "Return Charge",
    "Investment",
    "Withdrawal",
    "Payment Received",
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Database</h1>
        <p className="text-muted-foreground">Master Financial Ledger - All transaction records</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Debit</div>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-debit">
              ৳{totals.debit.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Credit</div>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-credit">
              ৳{totals.credit.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Profit</div>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-profit">
              ৳{totals.profit.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="h-5 w-5" />
              Transaction Records
              <Badge variant="secondary" data-testid="text-transaction-count">
                {filteredTransactions.length}
              </Badge>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-[250px]"
                  data-testid="input-search"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
              <DatabaseIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm">Transactions will appear here automatically when you create sales, purchases, expenses, and other financial activities.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => handleSort("date")}
                        data-testid="button-sort-date"
                      >
                        Date
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => handleSort("debit")}
                        data-testid="button-sort-debit"
                      >
                        Debit
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => handleSort("credit")}
                        data-testid="button-sort-credit"
                      >
                        Credit
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => handleSort("profit")}
                        data-testid="button-sort-profit"
                      >
                        Profit
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {transaction.date
                          ? format(new Date(transaction.date), "dd MMM yyyy, hh:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={categoryColors[transaction.category] || ""}
                          data-testid={`badge-category-${transaction.id}`}
                        >
                          {transaction.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.source}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {(transaction.debit ?? 0) > 0
                          ? `৳${transaction.debit!.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {(transaction.credit ?? 0) > 0
                          ? `৳${transaction.credit!.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {(transaction.profit ?? 0) !== 0
                          ? `৳${transaction.profit!.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
