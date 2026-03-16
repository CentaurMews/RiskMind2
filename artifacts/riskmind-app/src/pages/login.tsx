import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import logo from "@assets/risk_mind_1773670829732.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("admin@acme.com");
  const [password, setPassword] = useState("password123");
  const [tenantSlug, setTenantSlug] = useState("acme");
  
  const loginMutation = useLogin();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setLocation("/dashboard", { replace: true });
    }
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await loginMutation.mutateAsync({
        data: { email, password, tenantSlug }
      });
      localStorage.setItem("accessToken", res.accessToken);
      setLocation("/dashboard");
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Dark abstract */}
      <div className="hidden lg:flex flex-1 bg-sidebar text-white items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-accent/50 to-sidebar pointer-events-none" />
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center mb-8">
            <img src={logo} alt="RiskMind" className="h-10 w-10 mr-3 invert" />
            <span className="font-bold text-3xl tracking-tight">RiskMind</span>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Enterprise Risk Intelligence.</h1>
          <p className="text-sidebar-foreground/70 text-lg leading-relaxed">
            Unify your risk register, compliance frameworks, and third-party vendor management in one monochrome, distraction-free environment.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center justify-center">
            <img src={logo} alt="RiskMind" className="h-8 w-8 mr-2" />
            <span className="font-bold text-2xl tracking-tight">RiskMind</span>
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight mb-2">Sign in to your account</h2>
          <p className="text-muted-foreground text-sm mb-8">Enter your credentials to access your tenant.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant Slug</Label>
              <Input 
                id="tenant" 
                value={tenantSlug} 
                onChange={(e) => setTenantSlug(e.target.value)} 
                required 
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="bg-muted/50"
              />
            </div>

            {loginMutation.isError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20 font-mono">
                Authentication failed. Check credentials.
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
