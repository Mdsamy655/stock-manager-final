import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Sales from "@/pages/sales";
import Expenses from "@/pages/expenses";
import Purchases from "@/pages/purchases";
import Customers from "@/pages/customers";
import CustomerDetails from "@/pages/customer-details";
import Payments from "@/pages/payments";
import Investors from "@/pages/investors";
import Suppliers from "@/pages/suppliers";
import Steadfast from "@/pages/steadfast";
import DatabasePage from "@/pages/database";
import Login from "@/pages/login";
import { Skeleton } from "@/components/ui/skeleton";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/sales" component={Sales} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/purchases" component={Purchases} />
      <Route path="/customers/:id" component={CustomerDetails} />
      <Route path="/customers" component={Customers} />
      <Route path="/payments" component={Payments} />
      <Route path="/investors" component={Investors} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/steadfast" component={Steadfast} />
      <Route path="/database" component={DatabasePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const style = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function AuthenticatedApp() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-3 border-b bg-background sticky top-0 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm font-medium text-muted-foreground">
              InventoryPro
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline" data-testid="text-user-name">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
