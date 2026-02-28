import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Plus, Banknote, Trash2 } from "lucide-react";
import type { Payment, Customer } from "@shared/schema";

const paymentFormSchema = z.object({
  customerId: z.coerce.number().positive("Select a customer"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

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

export default function Payments() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: paymentsList, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: customersList } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { customerId: 0, amount: 0 },
  });

  const selectedCustomerId = form.watch("customerId");
  const selectedCustomer = customersList?.find((c) => c.id === Number(selectedCustomerId));

  const createMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      await apiRequest("POST", "/api/payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      form.reset();
      toast({ title: "Payment recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Payment deleted and customer due restored" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const customersWithDue = customersList?.filter((c) => c.dueAmount > 0) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Record customer payments and reduce dues
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-record-payment">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-customer">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customersWithDue.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.name} (Due: {formatTaka(customer.dueAmount)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max={selectedCustomer?.dueAmount ?? 999999}
                          placeholder="0"
                          {...field}
                          data-testid="input-payment-amount"
                        />
                      </FormControl>
                      {selectedCustomer && (
                        <p className="text-xs text-muted-foreground">
                          Current Due: {formatTaka(selectedCustomer.dueAmount)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedCustomer && form.watch("amount") > 0 && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Due:</span>
                      <span>{formatTaka(selectedCustomer.dueAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment:</span>
                      <span className="text-emerald-600">-{formatTaka(form.watch("amount"))}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground font-medium">Remaining Due:</span>
                      <span className="font-semibold">
                        {formatTaka(Math.max(0, selectedCustomer.dueAmount - form.watch("amount")))}
                      </span>
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-payment">
                  {createMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paymentsList && paymentsList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsList.map((payment) => (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell className="font-medium">{payment.customerName}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatTaka(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDate(payment.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive" disabled={deleteMutation.isPending} data-testid={`button-delete-payment-${payment.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this payment of {formatTaka(payment.amount)} from {payment.customerName}? The customer's due will be increased by this amount.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(payment.id)}
                                className="bg-destructive text-destructive-foreground"
                                data-testid="button-confirm-delete"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No payments recorded</h3>
              <p className="text-sm text-muted-foreground mt-1">Record a payment to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
