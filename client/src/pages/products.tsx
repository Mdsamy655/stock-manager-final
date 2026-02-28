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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Package, Pencil } from "lucide-react";
import type { Product } from "@shared/schema";

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  productCode: z.string().min(1, "Product code is required"),
  costPrice: z.coerce.number().positive("Must be greater than 0"),
  salePrice: z.coerce.number().positive("Must be greater than 0"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const stockAdjustSchema = z.object({
  adjustmentType: z.enum(["add", "reduce", "set"]),
  quantity: z.coerce.number().int().min(0, "Quantity must be 0 or greater"),
  reason: z.string().optional(),
});

type StockAdjustValues = z.infer<typeof stockAdjustSchema>;

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

export default function Products() {
  const [open, setOpen] = useState(false);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { name: "", productCode: "", costPrice: 0, salePrice: 0, stock: 0 },
  });

  const stockForm = useForm<StockAdjustValues>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: { adjustmentType: "add", quantity: 0, reason: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      form.reset();
      toast({ title: "Product added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Product deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (data: StockAdjustValues & { productId: number }) => {
      await apiRequest("POST", `/api/products/${data.productId}/adjust-stock`, {
        adjustmentType: data.adjustmentType,
        quantity: data.quantity,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setStockModalProduct(null);
      stockForm.reset();
      toast({ title: "Stock adjusted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const adjustmentType = stockForm.watch("adjustmentType");
  const adjustQuantity = stockForm.watch("quantity");

  const qty = Number(adjustQuantity) || 0;
  const previewStock = stockModalProduct
    ? adjustmentType === "add"
      ? stockModalProduct.stock + qty
      : adjustmentType === "reduce"
        ? stockModalProduct.stock - qty
        : qty
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your product inventory</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter product name" {...field} data-testid="input-product-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter barcode / product code" {...field} data-testid="input-product-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price (৳)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} data-testid="input-cost-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price (৳)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} data-testid="input-sale-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} data-testid="input-stock" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-product">
                  {createMutation.isPending ? "Adding..." : "Add Product"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!stockModalProduct} onOpenChange={(v) => { if (!v) { setStockModalProduct(null); stockForm.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {stockModalProduct?.name}</DialogTitle>
          </DialogHeader>
          <Form {...stockForm}>
            <form
              onSubmit={stockForm.handleSubmit((data) => {
                if (!stockModalProduct) return;
                adjustStockMutation.mutate({ ...data, productId: stockModalProduct.id });
              })}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Current Stock:</span>
                <span className="text-lg font-bold" data-testid="text-current-stock">{stockModalProduct?.stock ?? 0}</span>
              </div>
              <FormField
                control={stockForm.control}
                name="adjustmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-adjustment-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="add">Add Stock</SelectItem>
                        <SelectItem value="reduce">Reduce Stock</SelectItem>
                        <SelectItem value="set">Set Exact Quantity</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} data-testid="input-adjust-quantity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stockForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Damaged goods, inventory count" {...field} data-testid="input-adjust-reason" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">New Stock:</span>
                <span
                  className={`text-lg font-bold ${previewStock < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                  data-testid="text-preview-stock"
                >
                  {previewStock}
                </span>
              </div>
              {previewStock < 0 && (
                <p className="text-sm text-red-600 dark:text-red-400">Stock cannot be negative</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={adjustStockMutation.isPending || previewStock < 0}
                data-testid="button-submit-adjust-stock"
              >
                {adjustStockMutation.isPending ? "Saving..." : "Save Adjustment"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Profit/Unit</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                      <TableCell className="text-muted-foreground font-mono text-sm" data-testid={`text-product-code-${product.id}`}>
                        {product.productCode || "-"}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{formatTaka(product.costPrice)}</TableCell>
                      <TableCell className="text-right">{formatTaka(product.salePrice)}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                        {formatTaka(product.salePrice - product.costPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Badge variant={product.stock <= 5 ? "destructive" : "secondary"}>
                            {product.stock}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setStockModalProduct(product);
                              stockForm.reset({ adjustmentType: "add", quantity: 0, reason: "" });
                            }}
                            data-testid={`button-adjust-stock-${product.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(product.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-product-${product.id}`}
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
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No products yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add your first product to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
