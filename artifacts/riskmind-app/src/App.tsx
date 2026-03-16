import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RiskList from "@/pages/risks/risk-list";
import RiskDetail from "@/pages/risks/risk-detail";
import RiskHeatmap from "@/pages/risks/risk-heatmap";
import SignalList from "@/pages/signals/signal-list";
import FindingList from "@/pages/signals/finding-list";
import VendorList from "@/pages/vendors/vendor-list";
import VendorDetail from "@/pages/vendors/vendor-detail";
import FrameworkList from "@/pages/compliance/framework-list";
import FrameworkDetail from "@/pages/compliance/framework-detail";
import ControlList from "@/pages/compliance/control-list";
import AlertList from "@/pages/alerts/alert-list";
import Settings from "@/pages/settings/settings";
import Foresight from "@/pages/foresight/foresight";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/risks" component={RiskList} />
      <Route path="/risks/heatmap" component={RiskHeatmap} />
      <Route path="/risks/:id" component={RiskDetail} />
      <Route path="/signals" component={SignalList} />
      <Route path="/signals/findings" component={FindingList} />
      <Route path="/vendors" component={VendorList} />
      <Route path="/vendors/:id" component={VendorDetail} />
      <Route path="/compliance" component={FrameworkList} />
      <Route path="/compliance/:id" component={FrameworkDetail} />
      <Route path="/controls" component={ControlList} />
      <Route path="/alerts" component={AlertList} />
      <Route path="/settings" component={Settings} />
      <Route path="/foresight" component={Foresight} />
      <Route path="/" component={() => {
        const [, setLocation] = useLocation();
        useEffect(() => {
          const token = localStorage.getItem('accessToken');
          setLocation(token ? '/dashboard' : '/login', { replace: true });
        }, [setLocation]);
        return null;
      }} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
