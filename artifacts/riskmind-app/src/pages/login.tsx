import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import logo from "@assets/risk_mind_1773670829732.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await loginMutation.mutateAsync({
        data: { email, password }
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
            <img src={logo} alt="RiskMind" className="h-16 w-16 mr-3 invert" />
            <span className="font-bold text-3xl tracking-tight">RiskMind</span>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">AI Native Enterprise Risk Management</h1>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center justify-center">
            <img src={logo} alt="RiskMind" className="h-16 w-16 mr-2" />
            <span className="font-bold text-2xl tracking-tight">RiskMind</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">Sign in to your account</h2>
          <p className="text-muted-foreground text-sm mb-8">Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Social login */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => toast({ title: "Coming soon", description: "Microsoft login will be available in v2.1" })}
              className="flex items-center justify-center gap-3 w-full border border-border rounded-md px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              {/* Microsoft SVG icon */}
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Continue with Microsoft
            </button>
            <button
              type="button"
              onClick={() => toast({ title: "Coming soon", description: "Google login will be available in v2.1" })}
              className="flex items-center justify-center gap-3 w-full border border-border rounded-md px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              {/* Google SVG icon */}
              <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.8 0 7 5.4 3.2 13.3l7.8 6.1C13 13.6 18 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-9.9 7.1-17z"/>
                <path fill="#FBBC05" d="M11 28.4c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1.2 16.2 0 20 0 24s1.2 7.8 3.2 11.1l7.8-6.7z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6 0-11-4-12.8-9.5l-7.8 6.7C7 42.6 14.8 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
