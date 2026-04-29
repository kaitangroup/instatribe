import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/components/user-context";
import Landing from "@/pages/landing";
import Quiz from "@/pages/quiz";
import TribeDashboard from "@/pages/tribe-dashboard";
import AdminPanel from "@/pages/admin";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UserProvider>
          <Router hook={useHashLocation}>
            <Switch>
              <Route path="/" component={Landing} />
              <Route path="/quiz" component={Quiz} />
              <Route path="/tribe" component={TribeDashboard} />
              <Route path="/admin" component={AdminPanel} />
              <Route component={NotFound} />
            </Switch>
          </Router>
          <Toaster />
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
