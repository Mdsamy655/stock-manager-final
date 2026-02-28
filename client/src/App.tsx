import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2 p-3 border-b bg-background sticky top-0 z-10">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <span className="text-sm font-medium text-muted-foreground">
                  InventoryPro
                </span>
              </header>
              <main className="flex-1 overflow-auto bg-background">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
