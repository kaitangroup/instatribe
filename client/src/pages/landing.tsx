import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/components/user-context";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, MessageCircle, Sparkles, Sun, Moon, ArrowRight, Shield, Zap } from "lucide-react";

export default function Landing() {
  const [, navigate] = useLocation();
  const { setUser } = useUser();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();

  const [mode, setMode] = useState<"home" | "join" | "login">("home");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const registerMutation = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      apiRequest("POST", "/api/register", data),
    onSuccess: async (res) => {
      const data = await res.json();
      setUser(data.user);
      // Small delay to let context update propagate
      setTimeout(() => {
        if (data.user.quizCompleted) {
          navigate("/tribe");
        } else {
          navigate("/quiz");
        }
      }, 50);
    },
    onError: () => toast({ title: "Something went wrong. Please try again.", variant: "destructive" }),
  });

  const loginMutation = useMutation({
    mutationFn: (data: { email: string }) => apiRequest("POST", "/api/login", data),
    onSuccess: async (res) => {
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "No account found.", variant: "destructive" });
        return;
      }
      setUser(data.user);
      setTimeout(() => {
        if (data.user.quizCompleted) {
          navigate("/tribe");
        } else {
          navigate("/quiz");
        }
      }, 50);
    },
    onError: () => toast({ title: "Login failed. Check your email.", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <svg aria-label="Kindred logo" viewBox="0 0 40 40" fill="none" className="w-8 h-8">
            <circle cx="20" cy="20" r="18" stroke="hsl(var(--primary))" strokeWidth="2"/>
            <circle cx="14" cy="16" r="4" fill="hsl(var(--primary))" opacity="0.7"/>
            <circle cx="26" cy="16" r="4" fill="hsl(var(--primary))"/>
            <circle cx="20" cy="26" r="4" fill="hsl(var(--accent))"/>
            <line x1="14" y1="16" x2="26" y2="16" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
            <line x1="14" y1="16" x2="20" y2="26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
            <line x1="26" y1="16" x2="20" y2="26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
          </svg>
          <span className="font-display font-semibold text-lg">Kindred</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setMode("login")} data-testid="button-login">
            Sign in
          </Button>
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {mode === "home" && (
          <>
            {/* Hero */}
            <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 max-w-3xl mx-auto w-full">
              <div className="tribe-badge mb-6 animate-fade-up">
                <Sparkles className="w-3 h-3" />
                AI-powered tribe matching
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-5 animate-fade-up" style={{ animationDelay: "0.05s" }}>
                Find your people.<br />
                <span style={{ color: "hsl(var(--accent))" }}>Automatically.</span>
              </h1>
              <p className="text-muted-foreground text-lg mb-10 max-w-xl animate-fade-up" style={{ animationDelay: "0.1s" }}>
                Answer a short personality quiz and Kindred instantly places you in a private group of up to 30 people who share your values, interests, and outlook on life — your Tribe.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "0.15s" }}>
                <Button
                  size="lg"
                  onClick={() => setMode("join")}
                  className="px-8 font-semibold"
                  data-testid="button-join"
                >
                  Find my tribe
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/admin")}>
                  Admin panel
                </Button>
              </div>
            </section>

            {/* How it works */}
            <section className="px-6 py-16 max-w-5xl mx-auto w-full">
              <h2 className="font-display text-2xl font-semibold text-center mb-12">How Kindred works</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: <Users className="w-5 h-5" />,
                    step: "01",
                    title: "Take the quiz",
                    desc: "Answer 18 thoughtful questions about your personality, values, interests, and what you're looking for in a group.",
                  },
                  {
                    icon: <Zap className="w-5 h-5" />,
                    step: "02",
                    title: "Get matched instantly",
                    desc: "Our algorithm finds your best-fit tribe using personality similarity scoring. No waiting, no browsing.",
                  },
                  {
                    icon: <MessageCircle className="w-5 h-5" />,
                    step: "03",
                    title: "Join your tribe",
                    desc: "You're placed in a private group of up to 30 like-minded people. Chat, share advice, and build lasting friendships.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col gap-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        {item.icon}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                    </div>
                    <h3 className="font-semibold text-base">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Trust */}
            <section className="px-6 py-12 max-w-3xl mx-auto w-full text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-3">
                <Shield className="w-4 h-4" />
                Groups are private and capped at 30 members
              </div>
              <p className="text-muted-foreground text-sm">When a tribe fills up, a new one is automatically seeded from the best-matching overflow members.</p>
            </section>
          </>
        )}

        {/* Join form */}
        {mode === "join" && (
          <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
            <div className="quiz-card w-full max-w-md animate-fade-up">
              <button onClick={() => setMode("home")} className="text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">← Back</button>
              <h2 className="font-display text-2xl font-semibold mb-1">Create your account</h2>
              <p className="text-muted-foreground text-sm mb-6">You'll answer the matching quiz right after.</p>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">Your name</Label>
                  <Input
                    id="name"
                    data-testid="input-name"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <Button
                  data-testid="button-submit-register"
                  className="mt-2 font-semibold"
                  disabled={!name.trim() || !email.trim() || registerMutation.isPending}
                  onClick={() => registerMutation.mutate({ name: name.trim(), email: email.trim() })}
                >
                  {registerMutation.isPending ? "Setting up…" : "Continue to quiz →"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">Sign in</button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Login form */}
        {mode === "login" && (
          <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
            <div className="quiz-card w-full max-w-sm animate-fade-up">
              <button onClick={() => setMode("home")} className="text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">← Back</button>
              <h2 className="font-display text-2xl font-semibold mb-1">Welcome back</h2>
              <p className="text-muted-foreground text-sm mb-6">Enter your email to continue.</p>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="login-email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    data-testid="input-login-email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <Button
                  data-testid="button-submit-login"
                  className="font-semibold"
                  disabled={!email.trim() || loginMutation.isPending}
                  onClick={() => loginMutation.mutate({ email: email.trim() })}
                >
                  {loginMutation.isPending ? "Signing in…" : "Sign in"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  New here?{" "}
                  <button onClick={() => setMode("join")} className="text-primary hover:underline font-medium">Find my tribe</button>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
