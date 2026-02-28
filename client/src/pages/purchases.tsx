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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, PackagePlus, Trash2 } from "lucide-react";
import type { Purchase, Product, Supplier } from "@shared/schema";

const purchaseFormSchema = z.object({
  productId: z.coerce.number().positive("Select a product"),
  supplierId: z.string().optional(),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

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

export default function Purchases() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: purchasesList, isLoading } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });

  const { data: productsList } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: suppliersList } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: { productId: 0, supplierId: "", quantity: 1 },
  });

  const selectedProductId = form.watch("productId");
  const selectedProduct = productsList?.find((p) => p.id === Number(selectedProductId));

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseFormValues) => {
      await apiRequest("POST", "/api/purchases", {
        productId: data.productId,
        supplierId: data.supplierId ? Number(data.supplierId) : null,
        quantity: data.quantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      form.reset();
      toast({ title: "Purchase recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/purchases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Purchase deleted and stock reduced" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalPurchasesAmount = purchasesList?.reduce((sum, p) => sum + p.totalCost, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Purchases</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Record stock purchases from suppliers
            {purchasesList && purchasesList.length > 0 && (
              <span className="ml-2 font-medium text-foreground">
                Total: {formatTaka(totalPurchasesAmount)}
              </span>
            )}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-record-purchase">
              <Plus className="h-4 w-4 mr-2" />
              Record Purchase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Purchase</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-purchase-product">
                            <SelectValue placeholder="Select a product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {productsList?.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name}
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
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-purchase-supplier">
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No supplier</SelectItem>
                          {suppliersList?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
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
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="1" {...field} data-testid="input-purchase-quantity" />
                      </FormControl>
                      {selectedProduct && (
                        <p className="text-xs text-muted-foreground">
                          Unit Cost: {formatTaka(selectedProduct.costPrice)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedProduct && form.watch("quantity") > 0 && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cost:</span>
                      <span className="font-semibold">
                        {formatTaka(selectedProduct.costPrice * form.watch("quantity"))}
                      </span>
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-purchase">
                  {createMutation.isPending ? "Recording..." : "Record Purchase"}
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
          ) : purchasesList && purchasesList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesList.map((purchase) => (
                    <TableRow key={purchase.id} data-testid={`row-purchase-${purchase.id}`}>
                      <TableCell className="font-medium">{purchase.productName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {purchase.supplierName || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{purchase.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatTaka(purchase.unitCost)}</TableCell>
                      <TableCell className="text-right font-medium">{formatTaka(purchase.totalCost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDate(purchase.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-purchase-${purchase.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Purchase</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure? This will reduce the stock of {purchase.productName} by {purchase.quantity} units.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(purchase.id)}
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
              <PackagePlus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No purchases recorded</h3>
              <p className="text-sm text-muted-foreground mt-1">Record your first purchase to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
