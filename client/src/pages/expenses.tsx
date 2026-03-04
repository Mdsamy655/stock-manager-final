import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Receipt, Truck, Package } from "lucide-react";
import type { Expense } from "@shared/schema";

const expenseCategories = [
  "Rent",
  "Utilities",
  "Salary",
  "Transport",
  "Supplies",
  "Marketing",
  "Maintenance",
  "Other",
];

const permanentAssetCategory = "Permanent Asset";

const expenseFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().min(1, "Select a category"),
  customCategory: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const categoryColors: Record<string, string> = {
  Rent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Utilities: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Salary: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Transport: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Supplies: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  Marketing: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  Maintenance: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Delivery: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "Permanent Asset": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  Other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

function ExpenseTable({ expenses, onDelete, isPending }: { expenses: Expense[]; onDelete: (id: number) => void; isPending: boolean }) {
  if (expenses.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
              <TableCell className="font-medium">{expense.description}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${categoryColors[expense.category] || categoryColors.Other}`}>
                  {expense.category}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">{formatTaka(expense.amount)}</TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {formatDate(expense.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(expense.id)}
                  disabled={isPending}
                  data-testid={`button-delete-expense-${expense.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Expenses() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: expensesList, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { description: "", amount: 0, category: "", customCategory: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => {
      const payload = {
        description: data.description,
        amount: data.amount,
        category: data.customCategory?.trim() || data.category,
      };
      await apiRequest("POST", "/api/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      form.reset();
      toast({ title: "Expense recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Expense deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const courierExpenses = expensesList?.filter((e) => e.category === "Delivery") ?? [];
  const otherExpenses = expensesList?.filter((e) => e.category !== "Delivery" && e.category !== permanentAssetCategory) ?? [];
  const permanentAssets = expensesList?.filter((e) => e.category === permanentAssetCategory) ?? [];

  const totalCourierExpenses = courierExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOtherExpenses = otherExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPermanentAssets = permanentAssets.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your business expenses, courier costs, and permanent assets
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter expense description" {...field} data-testid="input-expense-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (৳)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0" {...field} data-testid="input-expense-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                          <SelectItem value={permanentAssetCategory}>
                            {permanentAssetCategory}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Category (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter custom category" {...field} data-testid="input-expense-custom-category" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-expense">
                  {createMutation.isPending ? "Adding..." : "Add Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Courier Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400" data-testid="text-courier-expenses">{formatTaka(totalCourierExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Other Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-other-expenses">{formatTaka(totalOtherExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Permanent Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" data-testid="text-total-permanent-assets">{formatTaka(totalPermanentAssets)}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Card data-testid="card-courier-expenses">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Courier Expenses ({courierExpenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {courierExpenses.length > 0 ? (
                <ExpenseTable expenses={courierExpenses} onDelete={(id) => deleteMutation.mutate(id)} isPending={deleteMutation.isPending} />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Truck className="h-10 w-10 text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm text-muted-foreground">No courier expenses recorded</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-other-expenses">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Other Expenses ({otherExpenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {otherExpenses.length > 0 ? (
                <ExpenseTable expenses={otherExpenses} onDelete={(id) => deleteMutation.mutate(id)} isPending={deleteMutation.isPending} />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm text-muted-foreground">No other expenses recorded</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-permanent-assets">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Permanent Assets ({permanentAssets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {permanentAssets.length > 0 ? (
                <ExpenseTable expenses={permanentAssets} onDelete={(id) => deleteMutation.mutate(id)} isPending={deleteMutation.isPending} />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Package className="h-10 w-10 text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm text-muted-foreground">No permanent assets recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
