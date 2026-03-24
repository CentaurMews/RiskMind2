import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import { CommandPalette } from "@/components/command-palette/command-palette";

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
import VendorOnboard from "@/pages/vendors/vendor-onboard";
import FrameworkList from "@/pages/compliance/framework-list";
import FrameworkDetail from "@/pages/compliance/framework-detail";
import ControlList from "@/pages/compliance/control-list";
import AlertList from "@/pages/alerts/alert-list";
import Settings from "@/pages/settings/settings";
import Foresight from "@/pages/foresight/foresight";
import AssessmentList from "@/pages/assessments/index";
import AssessmentTemplateLibrary from "@/pages/assessments/templates/index";
import AssessmentTemplateBuilder from "@/pages/assessments/templates/builder";
import AssessmentSession from "@/pages/assessments/session";
import AssessmentResults from "@/pages/assessments/results";

function AssessmentNew() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("templateId");
    if (!templateId) { setLocation("/assessments/templates"); return; }
    const token = localStorage.getItem("accessToken");
    fetch("/api/v1/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ templateId, contextType: "vendor" }),
    })
      .then((r) => r.json())
      .then((data) => setLocation(`/assessments/${data.id}/session`, { replace: true }))
      .catch(() => setLocation("/assessments/templates"));
  }, [setLocation]);
  return <div className="flex items-center justify-center h-screen text-muted-foreground">Creating assessment…</div>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedPage({ Component }: { Component: React.ComponentType }) {
  return (
    <ProtectedRoute>
      <Component />
    </ProtectedRoute>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">{() => <ProtectedPage Component={Dashboard} />}</Route>
      <Route path="/risks/heatmap">{() => <ProtectedPage Component={RiskHeatmap} />}</Route>
      <Route path="/risks/:id">{() => <ProtectedPage Component={RiskDetail} />}</Route>
      <Route path="/risks">{() => <ProtectedPage Component={RiskList} />}</Route>
      <Route path="/signals/findings">{() => <ProtectedPage Component={FindingList} />}</Route>
      <Route path="/signals">{() => <ProtectedPage Component={SignalList} />}</Route>
      <Route path="/vendors/onboard/:id">{() => <ProtectedPage Component={VendorOnboard} />}</Route>
      <Route path="/vendors/:id">{() => <ProtectedPage Component={VendorDetail} />}</Route>
      <Route path="/vendors">{() => <ProtectedPage Component={VendorList} />}</Route>
      <Route path="/compliance/:id">{() => <ProtectedPage Component={FrameworkDetail} />}</Route>
      <Route path="/compliance">{() => <ProtectedPage Component={FrameworkList} />}</Route>
      <Route path="/controls">{() => <ProtectedPage Component={ControlList} />}</Route>
      <Route path="/alerts">{() => <ProtectedPage Component={AlertList} />}</Route>
      <Route path="/settings">{() => <ProtectedPage Component={Settings} />}</Route>
      <Route path="/foresight">{() => <ProtectedPage Component={Foresight} />}</Route>
      <Route path="/assessments/templates/new">{() => <ProtectedPage Component={AssessmentTemplateBuilder} />}</Route>
      <Route path="/assessments/templates/:id/edit">{() => <ProtectedPage Component={AssessmentTemplateBuilder} />}</Route>
      <Route path="/assessments/templates">{() => <ProtectedPage Component={AssessmentTemplateLibrary} />}</Route>
      <Route path="/assessments/new">{() => <ProtectedPage Component={AssessmentNew} />}</Route>
      <Route path="/assessments/:id/session">{() => <ProtectedPage Component={AssessmentSession} />}</Route>
      <Route path="/assessments/:id/results">{() => <ProtectedPage Component={AssessmentResults} />}</Route>
      <Route path="/assessments">{() => <ProtectedPage Component={AssessmentList} />}</Route>
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
          <CommandPalette />
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
