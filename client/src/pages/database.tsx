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
import { Database as DatabaseIcon, Search } from "lucide-react";
import type { TransactionHistory } from "@shared/schema";
import { format } from "date-fns";

const actionColors: Record<string, string> = {
  "Sale": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Purchase": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Other Expense": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Courier Expense": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Return Charge": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Investment": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Withdrawal": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Payment Received": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

const actionTypes = [
  "Sale",
  "Purchase",
  "Courier Expense",
  "Return Charge",
  "Other Expense",
  "Investment",
  "Payment Received",
  "Withdrawal",
];

export default function DatabasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: allHistory, isLoading } = useQuery<TransactionHistory[]>({
    queryKey: ["/api/transaction-history"],
  });

  const filteredHistory = (allHistory || [])
    .filter((t) => {
      if (actionFilter !== "all" && t.actionType !== actionFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          t.description.toLowerCase().includes(query) ||
          t.reference.toLowerCase().includes(query) ||
          t.actionType.toLowerCase().includes(query)
        );
      }
      return true;
    });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Database</h1>
        <p className="text-muted-foreground">Financial Activity History</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="h-5 w-5" />
              Activity Records
              <Badge variant="secondary" data-testid="text-record-count">
                {filteredHistory.length}
              </Badge>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-[250px]"
                  data-testid="input-search"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
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
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
              <DatabaseIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No activity records found</p>
              <p className="text-sm">Records will appear here automatically when financial activities occur in the system.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((entry) => (
                    <TableRow key={entry.id} data-testid={`row-activity-${entry.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {entry.date
                          ? format(new Date(entry.date), "dd MMM yyyy, hh:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={actionColors[entry.actionType] || ""}
                          data-testid={`badge-type-${entry.id}`}
                        >
                          {entry.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.reference}
                      </TableCell>
                      <TableCell className="max-w-[350px] truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ৳{(entry.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
