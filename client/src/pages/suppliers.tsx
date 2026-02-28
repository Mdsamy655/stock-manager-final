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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Truck } from "lucide-react";
import type { Supplier } from "@shared/schema";

const supplierFormSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  dueAmount: z.coerce.number().min(0, "Due amount cannot be negative"),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

export default function Suppliers() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: suppliersList, isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: { name: "", phone: "", address: "", dueAmount: 0 },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      await apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setOpen(false);
      form.reset();
      toast({ title: "Supplier added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Supplier deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalDue = suppliersList?.reduce((sum, s) => sum + s.dueAmount, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your suppliers
            {suppliersList && suppliersList.length > 0 && (
              <span className="ml-2 font-medium text-foreground">
                Total Due: {formatTaka(totalDue)}
              </span>
            )}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-supplier">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter supplier name" {...field} data-testid="input-supplier-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} data-testid="input-supplier-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter address" {...field} data-testid="input-supplier-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Amount (৳)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0" {...field} data-testid="input-supplier-due" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-supplier">
                  {createMutation.isPending ? "Adding..." : "Add Supplier"}
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
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : suppliersList && suppliersList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Due Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersList.map((supplier) => (
                    <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.address}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={supplier.dueAmount > 0 ? "destructive" : "secondary"}>
                          {formatTaka(supplier.dueAmount)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(supplier.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-supplier-${supplier.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No suppliers yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add your first supplier to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
