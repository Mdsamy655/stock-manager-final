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
import { Plus, Landmark, Trash2 } from "lucide-react";
import type { Investor, Product } from "@shared/schema";

const investorFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  investedAmount: z.coerce.number().positive("Amount must be greater than 0"),
  investmentType: z.enum(["cash", "product"]),
  productId: z.coerce.number().optional(),
});

type InvestorFormValues = z.infer<typeof investorFormSchema>;

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

export default function Investors() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: investorsList, isLoading } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const { data: productsList } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<InvestorFormValues>({
    resolver: zodResolver(investorFormSchema),
    defaultValues: { name: "", investedAmount: 0, investmentType: "cash" },
  });

  const investmentType = form.watch("investmentType");

  const createMutation = useMutation({
    mutationFn: async (data: InvestorFormValues) => {
      const body: Record<string, unknown> = {
        name: data.name,
        investedAmount: data.investedAmount,
        investmentType: data.investmentType,
      };
      if (data.investmentType === "product" && data.productId) {
        body.productId = data.productId;
      }
      await apiRequest("POST", "/api/investors", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      form.reset();
      toast({ title: "Investment recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/investors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Investment deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalInvestment = investorsList?.reduce((sum, i) => sum + i.investedAmount, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Investors</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track investor contributions
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-investor">
              <Plus className="h-4 w-4 mr-2" />
              Add Investment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Investment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Investor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter name" {...field} data-testid="input-investor-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="investedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (৳)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="0" {...field} data-testid="input-investor-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="investmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-investment-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {investmentType === "product" && (
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-investment-product">
                              <SelectValue placeholder="Select product" />
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
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-investor">
                  {createMutation.isPending ? "Recording..." : "Record Investment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Investment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-investment">{formatTaka(totalInvestment)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : investorsList && investorsList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investorsList.map((investor) => {
                    const product = investor.productId ? productsList?.find((p) => p.id === investor.productId) : null;
                    return (
                      <TableRow key={investor.id} data-testid={`row-investor-${investor.id}`}>
                        <TableCell className="font-medium">{investor.name}</TableCell>
                        <TableCell className="text-right font-medium">{formatTaka(investor.investedAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {investor.investmentType === "cash" ? "Cash" : `Product${product ? ` (${product.name})` : ""}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {formatDate(investor.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive" disabled={deleteMutation.isPending} data-testid={`button-delete-investor-${investor.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Investment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this investment of {formatTaka(investor.investedAmount)} by {investor.name}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(investor.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No investments recorded</h3>
              <p className="text-sm text-muted-foreground mt-1">Record your first investment to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
