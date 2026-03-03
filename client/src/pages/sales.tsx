import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, ShoppingCart, Trash2, X, FileText, ScanBarcode, Sparkles } from "lucide-react";
import type { Product, Customer, SaleWithItems } from "@shared/schema";
import InvoiceModal from "@/components/invoice-modal";

interface SaleLineItem {
  productId: number;
  quantity: number;
  salePrice: number;
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

const BANGLA_DIGITS: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

function normalizeBanglaDigits(text: string): string {
  return text.replace(/[০-৯]/g, (ch) => BANGLA_DIGITS[ch] || ch);
}

const ADDRESS_KEYWORDS = /\b(road|rd|street|st|house|building|village|market|bazar|bazaar|union|thana|upazila|district|block|sector|lane|area|town|city|division|post|po|ps|flat|floor|gate|nagar|para|gali|mohalla|colony)\b|রোড|রাস্তা|বাড়ি|বাসা|গ্রাম|পাড়া|বাজার|ইউনিয়ন|থানা|উপজেলা|জেলা|ডাকঘর|সড়ক|লেন|এলাকা|শহর|বিভাগ|মহল্লা|নগর|ব্লক|সেক্টর|ফ্ল্যাট/i;

const NAME_PREFIXES = /^(মোঃ|মো:|মোহাম্মদ|মুহাম্মদ|শেখ|md\.?|mohammad|muhammad|sheikh|sk\.?|begum|বেগম|মিসেস|mrs\.?|mr\.?|মিস|miss|ms\.?)$/i;

function isAddressWord(word: string): boolean {
  return ADDRESS_KEYWORDS.test(word);
}

function isNamePrefix(word: string): boolean {
  return NAME_PREFIXES.test(word);
}

function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

function parseAICustomerInput(raw: string): { name: string; phone: string; address: string } {
  const text = raw.trim();
  if (!text) return { name: "", phone: "", address: "" };

  const normalized = normalizeBanglaDigits(text);

  const labeledName = normalized.match(/(?:name|নাম)\s*[:\-]\s*(.+?)(?=(?:phone|ফোন|মোবাইল|mobile|number|নম্বর|address|ঠিকানা)\s*[:\-]|$)/i);
  const labeledPhone = normalized.match(/(?:phone|ফোন|মোবাইল|mobile|number|নম্বর)\s*[:\-]\s*(.+?)(?=(?:name|নাম|address|ঠিকানা)\s*[:\-]|$)/i);
  const labeledAddress = normalized.match(/(?:address|ঠিকানা)\s*[:\-]\s*(.+?)(?=(?:name|নাম|phone|ফোন|মোবাইল|mobile)\s*[:\-]|$)/i);

  if (labeledName || labeledPhone || labeledAddress) {
    const phone = labeledPhone ? labeledPhone[1].trim().replace(/[^\d+]/g, "") : "";
    return {
      name: labeledName ? labeledName[1].trim() : "",
      phone,
      address: labeledAddress ? labeledAddress[1].trim() : "",
    };
  }

  const phoneRegex = /(?:(?:\+?880)|0)1[3-9]\d{8}/;
  const phoneMatch = normalized.match(phoneRegex);
  const phone = phoneMatch ? phoneMatch[0] : "";

  const origText = text;
  let remaining = origText;
  if (phoneMatch && phoneMatch.index !== undefined) {
    remaining = (origText.substring(0, phoneMatch.index) + " " + origText.substring(phoneMatch.index + phoneMatch[0].length)).trim();
  }

  remaining = remaining.replace(/\s+/g, " ").trim();

  if (!remaining) return { name: "", phone, address: "" };

  const commaSegments = remaining.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);

  if (commaSegments.length >= 3) {
    const nameIdx = commaSegments.findIndex(s => !hasDigit(s) && !isAddressWord(s) && s.split(/\s+/).length <= 3);
    if (nameIdx >= 0) {
      const name = commaSegments[nameIdx];
      const address = commaSegments.filter((_, i) => i !== nameIdx).join(", ");
      return { name, phone, address };
    }
    return { name: commaSegments[0], phone, address: commaSegments.slice(1).join(", ") };
  }

  if (commaSegments.length === 2) {
    const seg0HasAddr = isAddressWord(commaSegments[0]) || hasDigit(commaSegments[0]);
    const seg1HasAddr = isAddressWord(commaSegments[1]) || hasDigit(commaSegments[1]);

    if (seg0HasAddr && !seg1HasAddr && commaSegments[1].split(/\s+/).length <= 3) {
      return { name: commaSegments[1], phone, address: commaSegments[0] };
    }
    return { name: commaSegments[0], phone, address: commaSegments[1] };
  }

  const words = remaining.split(/\s+/);

  if (words.length === 1) {
    return { name: words[0], phone, address: "" };
  }

  const nameWords: string[] = [];
  const addressWords: string[] = [];
  let nameDone = false;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (!nameDone) {
      if (isNamePrefix(w)) {
        nameWords.push(w);
        continue;
      }

      if (hasDigit(w) || isAddressWord(w)) {
        nameDone = true;
        addressWords.push(w);
        continue;
      }

      if (nameWords.length < 3) {
        const lookAhead = words.slice(i + 1);
        const nextIsAddr = lookAhead.length > 0 && (isAddressWord(lookAhead[0]) || hasDigit(lookAhead[0]));

        if (nameWords.length >= 1 && nextIsAddr) {
          nameWords.push(w);
          nameDone = true;
          continue;
        }

        nameWords.push(w);

        if (nameWords.filter(nw => !isNamePrefix(nw)).length >= 2 && i + 1 < words.length) {
          const restHasAddr = words.slice(i + 1).some(rw => isAddressWord(rw) || hasDigit(rw));
          if (restHasAddr) {
            nameDone = true;
          }
        }
      } else {
        nameDone = true;
        addressWords.push(w);
      }
    } else {
      addressWords.push(w);
    }
  }

  if (nameWords.length === 0 && addressWords.length > 0) {
    const nonAddrIdx = addressWords.findIndex(w => !isAddressWord(w) && !hasDigit(w));
    if (nonAddrIdx >= 0) {
      nameWords.push(...addressWords.splice(nonAddrIdx, 1));
    }
  }

  return {
    name: nameWords.join(" ").trim(),
    phone,
    address: addressWords.join(" ").trim(),
  };
}

export default function Sales() {
  const [open, setOpen] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<SaleWithItems | null>(null);
  const { toast } = useToast();

  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([{ productId: 0, quantity: 1, salePrice: 0 }]);
  const [customerMode, setCustomerMode] = useState<"none" | "existing" | "new" | "ai">("none");
  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [smartInput, setSmartInput] = useState("");
  const [aiPreview, setAiPreview] = useState<{ name: string; phone: string; address: string } | null>(null);
  const [saveToCustomerList, setSaveToCustomerList] = useState(true);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [addCodFee, setAddCodFee] = useState(false);
  const [weightOverride, setWeightOverride] = useState<string>("");

  const { data: salesList, isLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customersList } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const resetForm = () => {
    setScanCode("");
    setScanError("");
    setLineItems([{ productId: 0, quantity: 1, salePrice: 0 }]);
    setCustomerMode("none");
    setCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerAddress("");
    setSaveToCustomerList(true);
    setPaidAmount("");
    setAddCodFee(false);
    setWeightOverride("");
  };

  const addProductByCode = useCallback((code: string) => {
    if (!code.trim() || !products) return;
    const matched = products.find((p) => p.productCode === code.trim());
    if (!matched) {
      setScanError("Product not found");
      setTimeout(() => { setScanCode(""); setScanError(""); }, 1000);
      return;
    }
    if (matched.stock <= 0) {
      setScanError(`${matched.name} — out of stock`);
      setTimeout(() => { setScanCode(""); setScanError(""); }, 1000);
      return;
    }
    setScanError("");
    setLineItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === matched.id);
      if (existingIndex >= 0) {
        return prev.map((item, i) => i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item);
      }
      const emptyIndex = prev.findIndex((item) => item.productId === 0);
      if (emptyIndex >= 0) {
        return prev.map((item, i) => i === emptyIndex ? { productId: matched.id, quantity: 1, salePrice: matched.salePrice } : item);
      }
      return [...prev, { productId: matched.id, quantity: 1, salePrice: matched.salePrice }];
    });
    setScanCode("");
    toast({ title: `Added: ${matched.name}` });
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [products, toast]);

  const handleScanInputChange = useCallback((value: string) => {
    setScanCode(value);
    setScanError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;
    debounceRef.current = setTimeout(() => {
      addProductByCode(value);
    }, 250);
  }, [addProductByCode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { productId: 0, quantity: 1, salePrice: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof SaleLineItem, value: number) => {
    setLineItems(lineItems.map((item, i) => {
      if (i !== index) return item;
      if (field === "productId") {
        const selectedProduct = products?.find((p) => p.id === value);
        return { ...item, productId: value, salePrice: selectedProduct?.salePrice ?? 0 };
      }
      return { ...item, [field]: value };
    }));
  };

  const getProduct = (productId: number) => products?.find((p) => p.id === productId);

  const subtotal = lineItems.reduce((sum, item) => {
    if (!item.productId || item.quantity <= 0) return sum;
    return sum + item.salePrice * item.quantity;
  }, 0);

  const totalWeight = lineItems.reduce((sum, item) => {
    if (!item.productId || item.quantity <= 0) return sum;
    const product = getProduct(item.productId);
    return sum + item.quantity * (product?.weightPerUnit ?? 0);
  }, 0);

  const codFeeAmount = addCodFee ? Math.round(subtotal * 0.01 * 100) / 100 : 0;

  const autoWeight = totalWeight;
  const effectiveWeight = weightOverride !== "" ? Math.max(0, Number(weightOverride) || 0) : autoWeight;

  const deliveryCharge = effectiveWeight > 0
    ? effectiveWeight <= 0.5
      ? 110
      : effectiveWeight <= 1
        ? 130
        : 130 + Math.ceil(effectiveWeight - 1) * 20
    : 0;

  const packingCharge = effectiveWeight > 0
    ? effectiveWeight > 5 ? 15 : 10
    : 0;

  const grandTotal = subtotal + codFeeAmount + deliveryCharge + packingCharge;

  const paid = paidAmount !== "" ? Number(paidAmount) : grandTotal;
  const due = Math.max(0, grandTotal - paid);

  const validItems = lineItems.filter((item) => item.productId > 0 && item.quantity > 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.salePrice,
        })),
        addCodFee,
      };
      if (customerMode === "existing" && customerId && customerId !== "none") {
        body.customerId = Number(customerId);
      } else if ((customerMode === "new" || customerMode === "ai") && newCustomerName.trim()) {
        body.customerName = newCustomerName.trim();
        if (newCustomerPhone.trim()) body.customerPhone = newCustomerPhone.trim();
        if (newCustomerAddress.trim()) body.customerAddress = newCustomerAddress.trim();
        body.saveToCustomerList = saveToCustomerList;
      }
      if (paidAmount !== "") {
        body.paidAmount = Number(paidAmount);
      }
      await apiRequest("POST", "/api/sales", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setOpen(false);
      resetForm();
      toast({ title: "Sale recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Sale deleted and stock restored" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalSalesAmount = salesList?.reduce((sum, s) => sum + s.totalPrice, 0) ?? 0;

  const usedProductIds = lineItems.map((item) => item.productId).filter((id) => id > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and record product sales
            {salesList && salesList.length > 0 && (
              <span className="ml-2 font-medium text-foreground">
                Total: {formatTaka(totalSalesAmount)}
              </span>
            )}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-record-sale">
              <Plus className="h-4 w-4 mr-2" />
              Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Sale</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={scanInputRef}
                    value={scanCode}
                    onChange={(e) => handleScanInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        addProductByCode(scanCode);
                      }
                    }}
                    placeholder="Scan barcode or type product code"
                    className={`pl-9 ${scanError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    autoFocus
                    data-testid="input-scan-code"
                  />
                </div>
                {scanError && (
                  <p className="text-xs text-red-500 mt-1" data-testid="text-scan-error">{scanError}</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Products</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-product-row">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Product
                  </Button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, index) => {
                    const product = getProduct(item.productId);
                    const lineTotal = item.salePrice * item.quantity;
                    const profitPerUnit = product ? item.salePrice - product.costPrice : 0;
                    return (
                      <div key={index} className="flex items-start gap-2 p-3 rounded-md border bg-muted/30" data-testid={`sale-line-item-${index}`}>
                        <div className="flex-1 space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Product</Label>
                            <Select
                              value={item.productId > 0 ? item.productId.toString() : ""}
                              onValueChange={(v) => updateLineItem(index, "productId", Number(v))}
                            >
                              <SelectTrigger data-testid={`select-product-${index}`}>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products?.filter((p) => p.stock > 0 && (!usedProductIds.includes(p.id) || p.id === item.productId)).map((p) => (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.productCode ? `[${p.productCode}] ` : ""}{p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Quantity{product ? ` (In Stock: ${product.stock})` : ""}
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                max={product?.stock ?? 999}
                                value={item.quantity}
                                onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value) || 1)}
                                data-testid={`input-quantity-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Sale Price{product ? ` (Cost: ${formatTaka(product.costPrice)})` : ""}
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.salePrice}
                                onChange={(e) => updateLineItem(index, "salePrice", parseFloat(e.target.value) || 0)}
                                data-testid={`input-sale-price-${index}`}
                              />
                            </div>
                          </div>
                          {product && (
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  Default: {formatTaka(product.salePrice)}
                                  {item.salePrice !== product.salePrice && (
                                    <span className={profitPerUnit >= 0 ? "text-emerald-600 dark:text-emerald-400 ml-2" : "text-red-600 dark:text-red-400 ml-2"}>
                                      Profit/unit: {formatTaka(profitPerUnit)}
                                    </span>
                                  )}
                                </span>
                                <span className="font-medium text-foreground">Line Total: {formatTaka(lineTotal)}</span>
                              </div>
                              {product.weightPerUnit > 0 && (
                                <div className="flex justify-end text-xs text-muted-foreground" data-testid={`text-line-weight-${index}`}>
                                  Weight: {(item.quantity * product.weightPerUnit).toFixed(2)} KG
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0 mt-5"
                            onClick={() => removeLineItem(index)}
                            data-testid={`button-remove-line-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Customer</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={customerMode === "none" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setCustomerMode("none"); setCustomerId(""); setNewCustomerName(""); }}
                    data-testid="button-customer-none"
                  >
                    No Customer
                  </Button>
                  <Button
                    type="button"
                    variant={customerMode === "existing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setCustomerMode("existing"); setNewCustomerName(""); }}
                    data-testid="button-customer-existing"
                  >
                    Existing Customer
                  </Button>
                  <Button
                    type="button"
                    variant={customerMode === "new" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setCustomerMode("new"); setCustomerId(""); }}
                    data-testid="button-customer-new"
                  >
                    New Customer
                  </Button>
                  <Button
                    type="button"
                    variant={customerMode === "ai" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setCustomerMode("ai"); setCustomerId(""); setSmartInput(""); setAiPreview(null); }}
                    data-testid="button-customer-ai"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    AI Customer Entry
                  </Button>
                </div>

                {customerMode === "existing" && (
                  <Select value={customerId || ""} onValueChange={setCustomerId}>
                    <SelectTrigger data-testid="select-customer">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customersList?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name} {customer.phone ? `(${customer.phone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(customerMode === "new" || customerMode === "ai") && (
                  <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                    {customerMode === "ai" && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          AI Customer Entry — type or paste in any format (Bangla / English)
                        </Label>
                        <textarea
                          value={smartInput}
                          onChange={(e) => { setSmartInput(e.target.value); setAiPreview(null); }}
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid="input-ai-customer"
                        />
                        {!aiPreview ? (
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            disabled={!smartInput.trim()}
                            onClick={() => {
                              const parsed = parseAICustomerInput(smartInput);
                              setAiPreview(parsed);
                            }}
                            data-testid="button-parse-fill"
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Parse & Fill
                          </Button>
                        ) : (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Review detected values — edit if needed, then confirm
                            </p>
                            <div className="space-y-1.5">
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Name</label>
                                <Input
                                  value={aiPreview.name}
                                  onChange={(e) => setAiPreview({ ...aiPreview, name: e.target.value })}
                                  className="h-8 text-sm"
                                  data-testid="input-ai-preview-name"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</label>
                                  <Input
                                    value={aiPreview.phone}
                                    onChange={(e) => setAiPreview({ ...aiPreview, phone: e.target.value })}
                                    className="h-8 text-sm"
                                    data-testid="input-ai-preview-phone"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</label>
                                  <Input
                                    value={aiPreview.address}
                                    onChange={(e) => setAiPreview({ ...aiPreview, address: e.target.value })}
                                    className="h-8 text-sm"
                                    data-testid="input-ai-preview-address"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  if (aiPreview.name) setNewCustomerName(aiPreview.name);
                                  if (aiPreview.phone) setNewCustomerPhone(aiPreview.phone);
                                  if (aiPreview.address) setNewCustomerAddress(aiPreview.address);
                                  setSmartInput("");
                                  setAiPreview(null);
                                }}
                                data-testid="button-ai-confirm"
                              >
                                Confirm & Fill
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setAiPreview(null)}
                                data-testid="button-ai-cancel"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Customer Name *</Label>
                      <Input
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Enter customer name"
                        data-testid="input-new-customer-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Phone Number</Label>
                        <Input
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          placeholder="Phone number"
                          data-testid="input-new-customer-phone"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <Input
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          placeholder="Address"
                          data-testid="input-new-customer-address"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="save-customer"
                        checked={saveToCustomerList}
                        onCheckedChange={(v) => setSaveToCustomerList(!!v)}
                        data-testid="checkbox-save-customer"
                      />
                      <label htmlFor="save-customer" className="text-sm text-muted-foreground cursor-pointer">
                        Save to Customer List
                      </label>
                    </div>
                    {due > 0 && !saveToCustomerList && (
                      <p className="text-xs text-amber-600">
                        Customer must be saved to Customer List when there is a due amount
                      </p>
                    )}
                  </div>
                )}
              </div>

              {subtotal > 0 && (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                    <Checkbox
                      id="cod-fee-toggle"
                      checked={addCodFee}
                      onCheckedChange={(v) => setAddCodFee(!!v)}
                      data-testid="checkbox-cod-fee"
                    />
                    <label htmlFor="cod-fee-toggle" className="text-sm cursor-pointer flex-1">
                      Add 1% COD Cost
                      {addCodFee && <span className="text-muted-foreground ml-2">({formatTaka(codFeeAmount)})</span>}
                    </label>
                  </div>

                  <div>
                    <Label className="text-sm">Paid Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      max={grandTotal}
                      placeholder={String(grandTotal)}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      inputMode="decimal"
                      data-testid="input-paid-amount"
                    />
                  </div>

                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal ({validItems.length} item{validItems.length !== 1 ? "s" : ""}):</span>
                      <span className="font-semibold">{formatTaka(subtotal)}</span>
                    </div>
                    {addCodFee && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">COD Fee (1%):</span>
                        <span className="font-medium">{formatTaka(codFeeAmount)}</span>
                      </div>
                    )}
                    {autoWeight > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Product Weight:</span>
                          <span className="font-medium text-muted-foreground">{autoWeight.toFixed(2)} KG</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs flex-1">Total Weight (editable):</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            className="w-24 h-7 text-xs text-right"
                            placeholder={autoWeight.toFixed(2)}
                            value={weightOverride}
                            onChange={(e) => setWeightOverride(e.target.value)}
                            data-testid="input-weight-override"
                          />
                          <span className="text-xs text-muted-foreground">KG</span>
                        </div>
                        {weightOverride !== "" && Number(weightOverride) !== autoWeight && (
                          <p className="text-xs text-amber-600">Weight adjusted from {autoWeight.toFixed(2)} KG to {effectiveWeight.toFixed(2)} KG</p>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Effective Weight:</span>
                          <span className="font-medium" data-testid="text-total-weight">{effectiveWeight.toFixed(2)} KG</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delivery Charge:</span>
                          <span className="font-medium" data-testid="text-delivery-charge">{formatTaka(deliveryCharge)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Packing Charge:</span>
                          <span className="font-medium" data-testid="text-packing-charge">{formatTaka(packingCharge)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground font-medium">Grand Total:</span>
                      <span className="font-bold" data-testid="text-grand-total">{formatTaka(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="text-emerald-600">{formatTaka(paid)}</span>
                    </div>
                    {due > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Due:</span>
                        <span className="font-semibold text-red-600">{formatTaka(due)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {due > 0 && customerMode === "none" && (
                <p className="text-xs text-amber-600" data-testid="text-due-warning">
                  A customer must be selected or created when there is a due amount
                </p>
              )}

              <Button
                className="w-full"
                disabled={createMutation.isPending || validItems.length === 0 || (due > 0 && customerMode === "none") || (due > 0 && (customerMode === "new" || customerMode === "ai") && !saveToCustomerList)}
                onClick={() => createMutation.mutate()}
                data-testid="button-submit-sale"
              >
                {createMutation.isPending ? "Recording..." : "Record Sale"}
              </Button>
            </div>
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
          ) : salesList && salesList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Products</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesList.map((sale) => {
                    const profit = sale.items.reduce((sum, item) => sum + (item.unitPrice - item.costPrice) * item.quantity, 0);
                    const itemsSummary = sale.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ");
                    return (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell className="font-medium max-w-[200px]">
                          <div className="space-y-0.5">
                            {sale.items.map((item, i) => (
                              <div key={i} className="text-sm">
                                <span>{item.quantity}x {item.productName}</span>
                                <span className="text-muted-foreground ml-1">@ {formatTaka(item.unitPrice)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{sale.customerName || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          <div>
                            {formatTaka(sale.totalPrice)}
                            {(sale.codFee ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground">incl. COD {formatTaka(sale.codFee)}</div>
                            )}
                            {(sale.totalWeight ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground">{(sale.totalWeight ?? 0).toFixed(2)} KG</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                          {formatTaka(sale.paidAmount ?? sale.totalPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(sale.dueAmount ?? 0) > 0 ? (
                            <span className="text-red-600 dark:text-red-400">{formatTaka(sale.dueAmount)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                          {formatTaka(profit)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {formatDate(sale.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setInvoiceSale(sale)} data-testid={`button-invoice-sale-${sale.id}`} title="Generate Invoice">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive" disabled={deleteMutation.isPending} data-testid={`button-delete-sale-${sale.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Sale</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this sale of {itemsSummary} ({formatTaka(sale.totalPrice)})? The stock will be restored automatically.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(sale.id)}
                                  className="bg-destructive text-destructive-foreground"
                                  data-testid="button-confirm-delete"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No sales recorded</h3>
              <p className="text-sm text-muted-foreground mt-1">Record your first sale to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {invoiceSale && (
        <InvoiceModal
          sale={invoiceSale}
          open={!!invoiceSale}
          onOpenChange={(v) => { if (!v) setInvoiceSale(null); }}
        />
      )}
    </div>
  );
}
