import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Truck, Send, RefreshCw, Package, CheckCircle, XCircle, Clock, Settings, Save, Trash2, Printer, ExternalLink, Timer } from "lucide-react";
import type { SaleWithItems } from "@shared/schema";
import CourierLabel from "@/components/courier-label";
import BulkLabelPrint from "@/components/bulk-label-print";

const AUTO_REFRESH_INTERVAL = 30 * 60 * 1000;

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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "delivered":
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" data-testid="badge-status-delivered"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
    case "in_review":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" data-testid="badge-status-in-review"><Clock className="h-3 w-3 mr-1" />In Review</Badge>;
    case "cancelled":
    case "cancelled_delivery":
    case "returned":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" data-testid="badge-status-cancelled"><XCircle className="h-3 w-3 mr-1" />Returned/Cancelled</Badge>;
    case "partial_delivered":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid="badge-status-partial"><Package className="h-3 w-3 mr-1" />Partial Delivered</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" data-testid="badge-status-pending"><Clock className="h-3 w-3 mr-1" />{status || "Pending"}</Badge>;
  }
}

interface SteadfastConfigData {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
}

export default function Steadfast() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://portal.packzy.com/api/v1");
  const [amountOverrides, setAmountOverrides] = useState<Record<number, number>>({});
  const [labelSale, setLabelSale] = useState<SaleWithItems | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPrintSales, setBulkPrintSales] = useState<SaleWithItems[] | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [bulkStatusTarget, setBulkStatusTarget] = useState<string | null>(null);
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<SteadfastConfigData>({
    queryKey: ["/api/steadfast-config"],
  });

  useEffect(() => {
    if (config) {
      setApiKey(config.apiKey);
      setSecretKey(config.secretKey);
      setBaseUrl(config.baseUrl);
    }
  }, [config]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/steadfast-config", { apiKey, secretKey, baseUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steadfast-config"] });
      toast({ title: "Settings Saved", description: "Steadfast API configuration updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: allSales = [], isLoading: salesLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales"],
  });

  const { data: courierSales = [], isLoading: courierLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/courier-sales"],
  });

  const refreshAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    setLastRefresh(new Date());
  }, []);

  const autoTrackStatuses = useCallback(async () => {
    const activeSales = courierSales.filter(
      (s) => s.consignmentId && s.courierStatus !== "delivered" && s.courierStatus !== "cancelled"
    );
    if (activeSales.length === 0) {
      refreshAllData();
      return;
    }

    try {
      await apiRequest("POST", "/api/steadfast/bulk-status", {
        saleIds: activeSales.map((s) => s.id),
      });
    } catch {
      // silently fail for auto-refresh
    }

    refreshAllData();
  }, [courierSales, refreshAllData]);

  useEffect(() => {
    if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current);

    autoRefreshTimer.current = setInterval(() => {
      autoTrackStatuses();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current);
    };
  }, [autoTrackStatuses]);

  const sendToCourier = useMutation({
    mutationFn: async ({ saleId, amount }: { saleId: number; amount: number }) => {
      const res = await apiRequest("POST", `/api/steadfast/send/${saleId}`, { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Sent to Steadfast", description: "Consignment created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async (saleId: number) => {
      const res = await apiRequest("POST", `/api/steadfast/status/${saleId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      const status = data?.courierStatus || "unknown";
      toast({ title: "Status Updated", description: `Delivery status: ${status}` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (saleIds: number[]) => {
      const res = await apiRequest("POST", "/api/steadfast/bulk-status", { saleIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const results = data?.results || [];
      const updated = results.filter((r: any) => r.status !== "skipped").length;
      toast({ title: "Bulk Status Updated", description: `${updated} order(s) checked` });
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkManualStatusMutation = useMutation({
    mutationFn: async ({ saleIds, status }: { saleIds: number[]; status: string }) => {
      const promises = saleIds.map((id) =>
        apiRequest("POST", `/api/steadfast/manual-status/${id}`, { status }).then((r) => r.json())
      );
      return Promise.allSettled(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Bulk Status Updated", description: `Status set to: ${bulkStatusTarget}` });
      setSelectedIds(new Set());
      setBulkStatusTarget(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCourierOrder = useMutation({
    mutationFn: async (saleId: number) => {
      const res = await apiRequest("DELETE", `/api/steadfast/order/${saleId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Disconnected", description: "Courier connection removed from sale" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const manualStatusMutation = useMutation({
    mutationFn: async ({ saleId, status }: { saleId: number; status: string }) => {
      const res = await apiRequest("POST", `/api/steadfast/manual-status/${saleId}`, { status });
      return res.json();
    },
    onSuccess: (_data: any, variables: { saleId: number; status: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Status Updated", description: `Manually set to: ${variables.status}` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const eligibleSales = allSales.filter(
    (s) => !s.isSentToCourier && s.customerName && s.customerPhone && s.customerAddress
  );

  const isLoading = salesLoading || courierLoading;
  const isConfigured = config && config.apiKey && config.secretKey;

  const handleTrack = (trackingCode: string) => {
    const trackUrl = `https://steadfast.com.bd/t/${trackingCode}`;
    window.open(trackUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Steadfast Courier</h1>
        <p className="text-muted-foreground text-sm mt-1">Send orders to Steadfast and track delivery status</p>
      </div>

      <Card data-testid="card-settings">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API Key"
                  data-testid="input-api-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretKey">Secret Key</Label>
                <Input
                  id="secretKey"
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Enter Secret Key"
                  data-testid="input-secret-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://portal.packzy.com/api/v1"
                  data-testid="input-base-url"
                />
              </div>
              <div className="sm:col-span-3">
                <Button
                  onClick={() => saveConfig.mutate()}
                  disabled={saveConfig.isPending || !apiKey || !secretKey || !baseUrl}
                  data-testid="button-save-config"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveConfig.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {eligibleSales.length > 0 && (
        <Card data-testid="card-eligible-sales">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Ready to Send ({eligibleSales.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[180px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleSales.map((sale) => (
                  <TableRow key={sale.id} data-testid={`row-eligible-${sale.id}`}>
                    <TableCell className="font-medium" data-testid={`text-sale-id-${sale.id}`}>#{sale.id}</TableCell>
                    <TableCell data-testid={`text-customer-${sale.id}`}>{sale.customerName}</TableCell>
                    <TableCell>{sale.customerPhone}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{sale.customerAddress}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-[120px] font-semibold"
                        value={amountOverrides[sale.id] ?? sale.dueAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setAmountOverrides((prev) => ({ ...prev, [sale.id]: val }));
                        }}
                        min={0}
                        data-testid={`input-amount-${sale.id}`}
                      />
                    </TableCell>
                    <TableCell>{formatDate(sale.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              disabled={sendToCourier.isPending || !isConfigured}
                              data-testid={`button-send-${sale.id}`}
                            >
                              <Truck className="h-4 w-4 mr-1" />
                              Send
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Send to Steadfast?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will create a consignment for {sale.customerName} with COD amount {formatTaka(amountOverrides[sale.id] ?? sale.dueAmount)}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-send">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => sendToCourier.mutate({ saleId: sale.id, amount: amountOverrides[sale.id] ?? sale.dueAmount })}
                                data-testid="button-confirm-send"
                              >
                                Confirm Send
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!isConfigured && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3" data-testid="text-config-warning">
                Configure API settings above before sending orders.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-courier-orders">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Courier Orders ({courierSales.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <Select
                      value={bulkStatusTarget || ""}
                      onValueChange={(value) => {
                        setBulkStatusTarget(value);
                        bulkManualStatusMutation.mutate({
                          saleIds: Array.from(selectedIds),
                          status: value,
                        });
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-bulk-status">
                        <SelectValue placeholder="Bulk Set Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkStatusMutation.mutate(Array.from(selectedIds))}
                      disabled={bulkStatusMutation.isPending || !isConfigured}
                      data-testid="button-bulk-check-status"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${bulkStatusMutation.isPending ? "animate-spin" : ""}`} />
                      Check Status ({selectedIds.size})
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const selected = courierSales.filter(s => selectedIds.has(s.id));
                        if (selected.length === 0) return;
                        setBulkPrintSales(selected);
                      }}
                      data-testid="button-print-selected-labels"
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      Print ({selectedIds.size})
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => autoTrackStatuses()}
                  disabled={bulkStatusMutation.isPending}
                  data-testid="button-refresh-all"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${bulkStatusMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh All
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-auto-refresh-info">
              <Timer className="h-3.5 w-3.5" />
              <span>Auto refresh every 30 minutes</span>
              <span className="text-muted-foreground/60">|</span>
              <span>Last refresh: {formatTime(lastRefresh)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : courierSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-courier-orders">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No courier orders yet</p>
              <p className="text-sm mt-1">Send sales to Steadfast to see them here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={courierSales.length > 0 && selectedIds.size === courierSales.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(courierSales.map(s => s.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Consignment ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Set Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierSales.map((sale) => (
                  <TableRow key={sale.id} data-testid={`row-courier-${sale.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(sale.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (checked) { next.add(sale.id); } else { next.delete(sale.id); }
                            return next;
                          });
                        }}
                        data-testid={`checkbox-select-${sale.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">#{sale.id}</TableCell>
                    <TableCell className="font-mono text-sm" data-testid={`text-consignment-${sale.id}`}>{sale.consignmentId || "-"}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{sale.customerPhone}</TableCell>
                    <TableCell className="font-semibold">{formatTaka(sale.totalPrice)}</TableCell>
                    <TableCell>{getStatusBadge(sale.courierStatus)}</TableCell>
                    <TableCell>
                      <Select
                        value={sale.courierStatus || "pending"}
                        onValueChange={(value) => manualStatusMutation.mutate({ saleId: sale.id, status: value })}
                        disabled={manualStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-[130px]" data-testid={`select-manual-status-${sale.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{formatDate(sale.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLabelSale(sale)}
                          data-testid={`button-print-label-${sale.id}`}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Label
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkStatusMutation.mutate(sale.id)}
                          disabled={checkStatusMutation.isPending || !isConfigured}
                          data-testid={`button-check-status-${sale.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${checkStatusMutation.isPending ? "animate-spin" : ""}`} />
                          Status
                        </Button>
                        {sale.trackingCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTrack(sale.trackingCode!)}
                            data-testid={`button-track-${sale.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Track
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteCourierOrder.isPending || sale.courierStatus === "delivered"}
                              data-testid={`button-delete-courier-${sale.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Disconnect Courier?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {sale.courierStatus === "delivered"
                                  ? "Delivered orders cannot be disconnected."
                                  : `This will remove the courier connection for ${sale.customerName}. The sale record will be kept unchanged.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-delete-courier">Cancel</AlertDialogCancel>
                              {sale.courierStatus !== "delivered" && (
                                <AlertDialogAction
                                  onClick={() => deleteCourierOrder.mutate(sale.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  data-testid="button-confirm-delete-courier"
                                >
                                  Delete
                                </AlertDialogAction>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {labelSale && (
        <CourierLabel
          sale={labelSale}
          open={!!labelSale}
          onOpenChange={(v) => { if (!v) setLabelSale(null); }}
        />
      )}

      {bulkPrintSales && bulkPrintSales.length > 0 && (
        <BulkLabelPrint
          sales={bulkPrintSales}
          onClose={() => setBulkPrintSales(null)}
        />
      )}
    </div>
  );
}
