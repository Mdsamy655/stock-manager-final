import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Wallet,
  Package,
  Receipt,
  BarChart3,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  Banknote,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  PiggyBank,
} from "lucide-react";
import type { DashboardStats, SaleWithItems } from "@shared/schema";

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const iconThemes = {
  blue: {
    bg: "bg-blue-500",
    light: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-600 dark:text-blue-400",
  },
  emerald: {
    bg: "bg-emerald-500",
    light: "bg-emerald-50 dark:bg-emerald-950",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-500",
    light: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    bg: "bg-violet-500",
    light: "bg-violet-50 dark:bg-violet-950",
    text: "text-violet-600 dark:text-violet-400",
  },
  rose: {
    bg: "bg-rose-500",
    light: "bg-rose-50 dark:bg-rose-950",
    text: "text-rose-600 dark:text-rose-400",
  },
  cyan: {
    bg: "bg-cyan-500",
    light: "bg-cyan-50 dark:bg-cyan-950",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  indigo: {
    bg: "bg-indigo-500",
    light: "bg-indigo-50 dark:bg-indigo-950",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  orange: {
    bg: "bg-orange-500",
    light: "bg-orange-50 dark:bg-orange-950",
    text: "text-orange-600 dark:text-orange-400",
  },
} as const;

type IconTheme = keyof typeof iconThemes;

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  theme = "blue",
  valueClass,
  testId,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  theme?: IconTheme;
  valueClass?: string;
  testId: string;
}) {
  const t = iconThemes[theme];
  return (
    <Card data-testid={testId} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${valueClass ?? ""}`} data-testid={`${testId}-value`}>
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${t.light} shrink-0`}>
            <Icon className={`h-5 w-5 ${t.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
      {children}
    </h2>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const { data: courierOrders = [] } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/courier-sales"],
  });

  const codPending = courierOrders
    .filter((s) => s.courierStatus === "pending" || s.courierStatus === "in_review")
    .reduce((sum, s) => sum + s.totalPrice, 0);
  const codDelivered = courierOrders
    .filter((s) => s.courierStatus === "delivered")
    .reduce((sum, s) => sum + s.totalPrice, 0);
  const codReturned = courierOrders
    .filter((s) => s.courierStatus === "returned" || s.courierStatus === "cancelled" || s.courierStatus === "cancelled_delivery")
    .reduce((sum, s) => sum + s.totalPrice, 0);
  const codTotal = courierOrders.reduce((sum, s) => sum + s.totalPrice, 0);

  const netProfit = (stats?.totalProfit ?? 0) - (stats?.totalExpenses ?? 0);

  return (
    <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-6">

      <div>
        <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Business performance overview</p>
      </div>

      {/* Hero — Cash & Sales */}
      <div className="space-y-2">
        <SectionLabel>Live Overview</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isLoading ? (
            <><StatSkeleton /><StatSkeleton /></>
          ) : stats ? (
            <>
              <Card data-testid="card-cash-in-hand" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cash In Hand</p>
                      <p
                        className={`text-3xl font-bold mt-1 tabular-nums ${stats.cashInHand >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                        data-testid="card-cash-in-hand-value"
                      >
                        {formatTaka(stats.cashInHand)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.cashInHand >= 0 ? "Available cash balance" : "Negative cash balance"}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-xl shrink-0 ${stats.cashInHand >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-rose-50 dark:bg-rose-950"}`}>
                      <Banknote className={`h-5 w-5 ${stats.cashInHand >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <StatCard
                title="Total Sales"
                value={formatTaka(stats.totalSales)}
                icon={ShoppingBag}
                description="Revenue from all sales"
                theme="blue"
                testId="card-total-sales"
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Profit section */}
      <div className="space-y-2">
        <SectionLabel>Profit & Expenses</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : stats ? (
            <>
              <Card data-testid="card-total-profit" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gross Profit</p>
                      <p
                        className={`text-2xl font-bold mt-1 tabular-nums ${stats.totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                        data-testid="card-total-profit-value"
                      >
                        {formatTaka(stats.totalProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Margin on all sales</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 shrink-0">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <StatCard
                title="Total Expenses"
                value={formatTaka(stats.totalExpenses)}
                icon={Receipt}
                description="Courier + other expenses"
                theme="rose"
                testId="card-total-expenses"
              />
              <Card data-testid="card-net-profit" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Profit</p>
                      <p
                        className={`text-2xl font-bold mt-1 tabular-nums ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                        data-testid="card-net-profit-value"
                      >
                        {formatTaka(netProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">After all expenses</p>
                    </div>
                    <div className={`p-2.5 rounded-xl shrink-0 ${netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-rose-50 dark:bg-rose-950"}`}>
                      {netProfit >= 0
                        ? <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        : <ArrowDownRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>
              <StatCard
                title="Other Expenses"
                value={formatTaka(stats.otherExpenses ?? 0)}
                icon={Receipt}
                description="Business expenses only"
                theme="orange"
                testId="card-other-expenses"
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Inventory section */}
      <div className="space-y-2">
        <SectionLabel>Inventory & Capital</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : stats ? (
            <>
              <StatCard
                title="Stock Value"
                value={formatTaka(stats.currentStockValue)}
                icon={Package}
                description={`${stats.totalProducts} products`}
                theme="indigo"
                testId="card-stock-value"
              />
              <StatCard
                title="Investment"
                value={formatTaka(stats.totalInvestment)}
                icon={Wallet}
                description="Capital in inventory"
                theme="violet"
                testId="card-total-investment"
              />
              <StatCard
                title="Working Capital"
                value={formatTaka(stats.availableWorkingCapital)}
                icon={PiggyBank}
                description="Available for ops"
                theme="cyan"
                testId="card-working-capital"
              />
              <Card data-testid="card-low-stock" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Low Stock</p>
                      <p className={`text-2xl font-bold mt-1 tabular-nums ${stats.lowStockProducts > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} data-testid="card-low-stock-value">
                        {stats.lowStockProducts}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">≤ 5 items left</p>
                    </div>
                    <div className={`p-2.5 rounded-xl shrink-0 ${stats.lowStockProducts > 0 ? "bg-amber-50 dark:bg-amber-950" : "bg-gray-50 dark:bg-gray-900"}`}>
                      <AlertTriangle className={`h-5 w-5 ${stats.lowStockProducts > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
        {!isLoading && stats && (
          <StatCard
            title="Permanent Assets"
            value={formatTaka(stats.totalPermanentAssets)}
            icon={BarChart3}
            description="Long-term asset value"
            theme="indigo"
            testId="card-permanent-assets"
          />
        )}
      </div>

      {/* Today & Month */}
      <div className="space-y-2">
        <SectionLabel>Period Summary</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isLoading ? (
            <><StatSkeleton /><StatSkeleton /></>
          ) : stats ? (
            <>
              <Card data-testid="card-today-summary" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950">
                      <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Sales</span>
                      <span className="text-lg font-bold tabular-nums" data-testid="card-today-sales-value">{formatTaka(stats.todaySales)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Profit</span>
                      <span className={`text-lg font-bold tabular-nums ${stats.todayProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} data-testid="card-today-profit-value">
                        {formatTaka(stats.todayProfit)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-month-summary" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950">
                      <CalendarRange className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Sales</span>
                      <span className="text-lg font-bold tabular-nums" data-testid="card-month-sales-value">{formatTaka(stats.monthSales)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Profit</span>
                      <span className={`text-lg font-bold tabular-nums ${stats.monthProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} data-testid="card-month-profit-value">
                        {formatTaka(stats.monthProfit)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      {/* COD Summary */}
      <div className="space-y-2">
        <SectionLabel>COD Summary</SectionLabel>
        <Card data-testid="card-cod-summary" className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950">
                <Truck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-sm font-semibold">Courier Cash on Delivery</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-3" data-testid="cod-pending">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">{formatTaka(codPending)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-3" data-testid="cod-delivered">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Delivered</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{formatTaka(codDelivered)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-3" data-testid="cod-returned">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">Returned</p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">{formatTaka(codReturned)}</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3" data-testid="cod-total">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Total COD</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">{formatTaka(codTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
