import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/components/user-context";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users, MessageCircle, Send, Sun, Moon, LogOut, ChevronRight,
  Hash, Info, Loader2
} from "lucide-react";

interface Member {
  id: number;
  name: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  bio: string | null;
  location: string | null;
  interests: string[];
  joinedAt: string;
}

interface Message {
  id: number;
  tribeId: number;
  userId: number;
  userName: string;
  userInitials: string;
  userColor: string;
  content: string;
  createdAt: string;
}

interface Tribe {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  maxMembers: number;
  primaryInterests: string;
  createdAt: string;
}

type Tab = "chat" | "members" | "about";

export default function TribeDashboard() {
  const [, navigate] = useLocation();
  const { user, setUser } = useUser();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user]);

  const tribeId = user?.tribeId;

  const { data: tribe } = useQuery<Tribe>({
    queryKey: ["/api/tribe", tribeId],
    queryFn: () => fetch(`/api/tribe/${tribeId}`).then((r) => r.json()),
    enabled: !!tribeId,
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/tribe", tribeId, "members"],
    queryFn: () => fetch(`/api/tribe/${tribeId}/members`).then((r) => r.json()),
    enabled: !!tribeId,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/tribe", tribeId, "messages"],
    queryFn: () => fetch(`/api/tribe/${tribeId}/messages`).then((r) => r.json()),
    enabled: !!tribeId,
    refetchInterval: 3000, // Poll every 3s
  });

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/tribe/${tribeId}/messages`, { userId: user!.id, content }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/tribe", tribeId, "messages"] });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  function handleSend() {
    const content = messageText.trim();
    if (!content) return;
    sendMutation.mutate(content);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  }

  if (!tribeId || !tribe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading your tribe…</p>
        </div>
      </div>
    );
  }

  const interests: string[] = (() => {
    try { return JSON.parse(tribe.primaryInterests ?? "[]"); } catch { return []; }
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <svg aria-label="Kindred logo" viewBox="0 0 40 40" fill="none" className="w-7 h-7 flex-shrink-0">
            <circle cx="20" cy="20" r="18" stroke="hsl(var(--primary))" strokeWidth="2"/>
            <circle cx="14" cy="16" r="4" fill="hsl(var(--primary))" opacity="0.7"/>
            <circle cx="26" cy="16" r="4" fill="hsl(var(--primary))"/>
            <circle cx="20" cy="26" r="4" fill="hsl(var(--accent))"/>
            <line x1="14" y1="16" x2="26" y2="16" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
            <line x1="14" y1="16" x2="20" y2="26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
            <line x1="26" y1="16" x2="20" y2="26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4"/>
          </svg>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-sm truncate">{tribe.name}</h1>
            <p className="text-xs text-muted-foreground">{tribe.memberCount} members</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { setUser(null); navigate("/"); }}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-border/50 flex px-4 flex-shrink-0">
        {([
          { id: "chat" as Tab, label: "Chat", icon: <Hash className="w-3.5 h-3.5" /> },
          { id: "members" as Tab, label: `Members (${members.length})`, icon: <Users className="w-3.5 h-3.5" /> },
          { id: "about" as Tab, label: "About", icon: <Info className="w-3.5 h-3.5" /> },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto styled-scroll px-4 py-4 space-y-4">
              {msgsLoading && (
                <div className="flex justify-center pt-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!msgsLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">No messages yet</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Be the first to say hello to your tribe!</p>
                </div>
              )}

              {groupedMessages.map(({ date, msgs }) => (
                <div key={date}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-xs text-muted-foreground">{date}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <div className="space-y-3">
                    {msgs.map((msg, i) => {
                      const isMe = msg.userId === user?.id;
                      const showAvatar = i === 0 || msgs[i - 1].userId !== msg.userId;
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`} data-testid={`message-${msg.id}`}>
                          {!isMe && (
                            <div
                              className="avatar-circle w-7 h-7 text-xs flex-shrink-0"
                              style={{ background: msg.userColor, opacity: showAvatar ? 1 : 0 }}
                            >
                              {msg.userInitials}
                            </div>
                          )}
                          <div className={`flex flex-col gap-0.5 max-w-xs ${isMe ? "items-end" : "items-start"}`}>
                            {showAvatar && !isMe && (
                              <span className="text-xs font-medium text-muted-foreground ml-1">{msg.userName}</span>
                            )}
                            <div
                              className={`message-bubble ${isMe
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-card border border-border/60 text-foreground rounded-bl-sm"
                              }`}
                            >
                              {msg.content}
                            </div>
                            <span className="text-xs text-muted-foreground/50 px-1">{formatTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-border/50 px-4 py-3 flex-shrink-0">
              <div className="flex items-end gap-2">
                <div
                  className="avatar-circle w-8 h-8 text-xs flex-shrink-0"
                  style={{ background: user?.avatarColor ?? "#6366f1" }}
                >
                  {user?.avatarInitials ?? "?"}
                </div>
                <Textarea
                  data-testid="input-message"
                  placeholder={`Message ${tribe.name}…`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-h-[44px] max-h-32 resize-none text-sm leading-relaxed py-2.5"
                  rows={1}
                />
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  className="flex-shrink-0 h-10 w-10 p-0"
                  data-testid="button-send"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/50 mt-1.5 ml-10">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </>
        )}

        {/* MEMBERS TAB */}
        {activeTab === "members" && (
          <div className="flex-1 overflow-y-auto styled-scroll">
            <div className="px-4 py-4 space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors" data-testid={`member-${member.id}`}>
                  <div
                    className="avatar-circle w-10 h-10 text-sm flex-shrink-0"
                    style={{ background: member.avatarColor ?? "#6366f1" }}
                  >
                    {member.avatarInitials ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{member.name}</p>
                      {member.id === user?.id && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">You</span>
                      )}
                    </div>
                    {member.location && (
                      <p className="text-xs text-muted-foreground">{member.location}</p>
                    )}
                    {member.bio && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{member.bio}</p>
                    )}
                    {member.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {member.interests.slice(0, 3).map((interest) => (
                          <span key={interest} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {interest}
                          </span>
                        ))}
                        {member.interests.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{member.interests.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === "about" && (
          <div className="flex-1 overflow-y-auto styled-scroll">
            <div className="px-4 py-6 max-w-lg">
              <div className="mb-6">
                <h2 className="font-display text-xl font-semibold mb-2">{tribe.name}</h2>
                {tribe.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{tribe.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
                  <p className="text-2xl font-bold font-display text-primary">{tribe.memberCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Members</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
                  <p className="text-2xl font-bold font-display text-primary">{tribe.maxMembers - tribe.memberCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Spots remaining</p>
                </div>
              </div>

              {interests.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm mb-3">Shared interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <span key={interest} className="tribe-badge">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About tribe matching</p>
                <p className="leading-relaxed text-xs">Members of this tribe were matched based on personality profile similarity, shared values, and overlapping interests. When the tribe reaches 30 members, new members with a similar profile will automatically form a new tribe.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
