import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Users, Hash, BarChart3, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { useState } from "react";

interface AdminTribe {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  maxMembers: number;
  primaryInterests: string;
  createdAt: string;
  members: {
    id: number;
    name: string;
    email: string;
    avatarInitials: string | null;
    avatarColor: string | null;
    joinedAt: string;
    quizCompleted: boolean;
  }[];
}

interface AdminStats {
  totalUsers: number;
  totalTribes: number;
  completedQuizzes: number;
  tribesAtCapacity: number;
}

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const { theme, toggle } = useTheme();
  const [expandedTribe, setExpandedTribe] = useState<number | null>(null);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: tribes = [] } = useQuery<AdminTribe[]>({
    queryKey: ["/api/admin/tribes"],
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <svg aria-label="Kindred logo" viewBox="0 0 40 40" fill="none" className="w-7 h-7">
              <circle cx="20" cy="20" r="18" stroke="hsl(var(--primary))" strokeWidth="2"/>
              <circle cx="14" cy="16" r="4" fill="hsl(var(--primary))" opacity="0.7"/>
              <circle cx="26" cy="16" r="4" fill="hsl(var(--primary))"/>
              <circle cx="20" cy="26" r="4" fill="hsl(var(--accent))"/>
              <line x1="14" y1="16" x2="26" y2="16" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
              <line x1="14" y1="16" x2="20" y2="26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
              <line x1="26" y1="16" x2="20" y2="26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
            </svg>
            <div>
              <span className="font-display font-semibold text-sm">Kindred</span>
              <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Admin</span>
            </div>
          </div>
        </div>
        <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted transition-colors">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold mb-1">Tribe Overview</h1>
          <p className="text-muted-foreground text-sm">Manage all tribes and monitor membership.</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Members", value: stats.totalUsers, icon: <Users className="w-4 h-4" /> },
              { label: "Active Tribes", value: stats.totalTribes, icon: <Hash className="w-4 h-4" /> },
              { label: "Quizzes Complete", value: stats.completedQuizzes, icon: <BarChart3 className="w-4 h-4" /> },
              { label: "Tribes at Capacity", value: stats.tribesAtCapacity, icon: <Users className="w-4 h-4" /> },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {stat.icon}
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tribes list */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">All Tribes</h2>
          {tribes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm bg-card rounded-2xl border border-border/50">
              No tribes yet. Users will be placed in tribes after completing the quiz.
            </div>
          )}
          {tribes.map((tribe) => {
            const interests: string[] = (() => {
              try { return JSON.parse(tribe.primaryInterests ?? "[]"); } catch { return []; }
            })();
            const isExpanded = expandedTribe === tribe.id;
            const fillPct = Math.round((tribe.memberCount / tribe.maxMembers) * 100);

            return (
              <div key={tribe.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden" data-testid={`tribe-${tribe.id}`}>
                {/* Tribe header */}
                <button
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedTribe(isExpanded ? null : tribe.id)}
                  data-testid={`tribe-toggle-${tribe.id}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "hsl(var(--primary) / 0.1)" }}>
                      <Hash className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-semibold text-sm truncate">{tribe.name}</p>
                      <p className="text-xs text-muted-foreground">Created {formatDate(tribe.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Fill bar */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${fillPct}%`,
                            background: fillPct >= 90 ? "hsl(var(--destructive))" : "hsl(var(--primary))"
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{tribe.memberCount}/{tribe.maxMembers}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-5 py-4">
                    {tribe.description && (
                      <p className="text-sm text-muted-foreground mb-4">{tribe.description}</p>
                    )}
                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {interests.map((interest) => (
                          <span key={interest} className="tribe-badge text-xs">{interest}</span>
                        ))}
                      </div>
                    )}
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">Members</h3>
                    <div className="space-y-2">
                      {tribe.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 py-1" data-testid={`admin-member-${member.id}`}>
                          <div
                            className="avatar-circle w-8 h-8 text-xs flex-shrink-0"
                            style={{ background: member.avatarColor ?? "#6366f1" }}
                          >
                            {member.avatarInitials ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.quizCompleted ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">Matched</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Pending</span>
                            )}
                            <span className="text-xs text-muted-foreground hidden sm:block">Joined {formatDate(member.joinedAt)}</span>
                          </div>
                        </div>
                      ))}
                      {tribe.members.length === 0 && (
                        <p className="text-xs text-muted-foreground">No members yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
