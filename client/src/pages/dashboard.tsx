import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Wallet,
  Package,
  Receipt,
  BarChart3,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  Banknote,
  Truck,
} from "lucide-react";
import type { DashboardStats, SaleWithItems } from "@shared/schema";

function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  testId,
}: {
  title: string;
  value: string;
  icon: any;
  description?: string;
  trend?: "up" | "down" | "neutral";
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`${testId}-value`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20 mt-2" />
      </CardContent>
    </Card>
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your business performance</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : stats ? (
          <>
            <Card data-testid="card-cash-in-hand">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash In Hand</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${stats.cashInHand >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  data-testid="card-cash-in-hand-value"
                >
                  {formatTaka(stats.cashInHand)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.cashInHand >= 0 ? "Available cash balance" : "Negative Cash Balance"}
                </p>
              </CardContent>
            </Card>
            <StatCard
              title="Current Stock Value"
              value={formatTaka(stats.currentStockValue)}
              icon={Package}
              description={`${stats.totalProducts} products in stock`}
              testId="card-stock-value"
            />
            <StatCard
              title="Total Sales"
              value={formatTaka(stats.totalSales)}
              icon={TrendingUp}
              description="Revenue from all sales"
              trend="up"
              testId="card-total-sales"
            />
            <StatCard
              title="Total Expenses"
              value={formatTaka(stats.totalExpenses)}
              icon={Receipt}
              description="All recorded expenses"
              testId="card-total-expenses"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : stats ? (
          <>
            <Card data-testid="card-total-profit">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  data-testid="card-total-profit-value"
                >
                  {formatTaka(stats.totalProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalProfit >= 0 ? "Net profit after expenses" : "Net loss after expenses"}
                </p>
              </CardContent>
            </Card>
            <StatCard
              title="Total In Stock"
              value={stats.totalProducts.toString()}
              icon={Package}
              description="Active products in catalog"
              testId="card-total-products"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              title="Total Investment"
              value={formatTaka(stats.totalInvestment)}
              icon={Wallet}
              description="Capital invested in inventory"
              testId="card-total-investment"
            />
            <Card data-testid="card-low-stock">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alert</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="card-low-stock-value">
                  {stats.lowStockProducts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Products with 5 or fewer items</p>
              </CardContent>
            </Card>
            <StatCard
              title="Working Capital"
              value={formatTaka(stats.availableWorkingCapital)}
              icon={Wallet}
              description="Available for operations"
              testId="card-working-capital"
            />
            <StatCard
              title="Permanent Assets"
              value={formatTaka(stats.totalPermanentAssets)}
              icon={Receipt}
              description="Long-term assets"
              testId="card-permanent-assets"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : stats ? (
          <>
            <Card data-testid="card-today-summary">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Today's Summary</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold" data-testid="card-today-sales-value">
                  Sales: {formatTaka(stats.todaySales)}
                </div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${stats.todayProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  data-testid="card-today-profit-value"
                >
                  Profit: {formatTaka(stats.todayProfit)}
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-month-summary">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold" data-testid="card-month-sales-value">
                  Sales: {formatTaka(stats.monthSales)}
                </div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${stats.monthProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  data-testid="card-month-profit-value"
                >
                  Profit: {formatTaka(stats.monthProfit)}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-1">
        <Card data-testid="card-cod-summary">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">COD Summary</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div data-testid="cod-pending">
                <p className="text-xs text-muted-foreground">Pending COD</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{formatTaka(codPending)}</p>
              </div>
              <div data-testid="cod-delivered">
                <p className="text-xs text-muted-foreground">Delivered COD</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatTaka(codDelivered)}</p>
              </div>
              <div data-testid="cod-returned">
                <p className="text-xs text-muted-foreground">Returned COD</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatTaka(codReturned)}</p>
              </div>
              <div data-testid="cod-total">
                <p className="text-xs text-muted-foreground">Total COD</p>
                <p className="text-lg font-bold">{formatTaka(codTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
