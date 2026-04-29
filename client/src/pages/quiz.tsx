import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/components/user-context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Question {
  id: string;
  section: string;
  question: string;
  type: "single" | "multi";
  options: string[];
  dimension: string;
  weight: number;
}

export default function Quiz() {
  const [, navigate] = useLocation();
  const { user, setUser } = useUser();
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [matchResult, setMatchResult] = useState<{ tribe: any; user: any } | null>(null);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/quiz/questions"],
  });

  // We do NOT redirect if no user — they can browse the quiz but will be prompted on submit

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/quiz/submit", data),
    onSuccess: async (res) => {
      const data = await res.json();
      setMatchResult(data);
      setUser(data.user);
      setIsComplete(true);
    },
    onError: () => toast({ title: "Something went wrong. Please try again.", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const progress = ((currentIndex) / totalQ) * 100;
  const currentAnswer = answers[currentQ?.id];
  const isAnswered = currentAnswer !== undefined && (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true);

  function handleSingle(option: string) {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
  }

  function handleMulti(option: string) {
    setAnswers((prev) => {
      const current = (prev[currentQ.id] as string[]) ?? [];
      if (current.includes(option)) {
        return { ...prev, [currentQ.id]: current.filter((o) => o !== option) };
      }
      return { ...prev, [currentQ.id]: [...current, option] };
    });
  }

  function handleNext() {
    if (currentIndex < totalQ - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function handleSubmit() {
    if (!user) {
      toast({ title: "Please create an account first.", variant: "destructive" });
      navigate("/");
      return;
    }
    const interests = (answers["primary_interests"] as string[]) ?? [];
    const lifestyle: Record<string, string> = {
      workStyle: answers["career_stage"] as string ?? "",
      socialStyle: answers["social_energy"] as string ?? "",
    };
    submitMutation.mutate({
      userId: user.id,
      answers,
      interests,
      lifestyle,
      personalityScores: {},
    });
  }

  // Get current section info
  const sections = [...new Set(questions.map((q) => q.section))];
  const currentSection = currentQ?.section;

  if (isComplete && matchResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-lg text-center animate-fade-up">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-ring"
            style={{ background: "hsl(var(--primary) / 0.1)" }}>
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>

          <h1 className="font-display text-3xl font-bold mb-2">You've been placed!</h1>
          <p className="text-muted-foreground mb-8">Welcome to your tribe. You've been matched with people who share your values and outlook.</p>

          {/* Tribe card */}
          <div className="quiz-card mb-6 text-left">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Your Tribe</p>
                <h2 className="font-display text-xl font-semibold">{matchResult.tribe.name}</h2>
              </div>
              <span className="tribe-badge">{matchResult.tribe.memberCount} / 30</span>
            </div>
            {matchResult.tribe.description && (
              <p className="text-sm text-muted-foreground">{matchResult.tribe.description}</p>
            )}
            {matchResult.tribe.primaryInterests && JSON.parse(matchResult.tribe.primaryInterests).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {(JSON.parse(matchResult.tribe.primaryInterests) as string[]).slice(0, 4).map((interest: string) => (
                  <span key={interest} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button className="w-full font-semibold" size="lg" onClick={() => navigate("/tribe")} data-testid="button-enter-tribe">
            Enter your tribe →
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header progress */}
      <header className="px-6 py-4 border-b border-border/50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
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
              <span className="font-display font-semibold text-base">Kindred</span>
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {currentIndex + 1} / {totalQ}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          {/* Section tabs */}
          <div className="flex gap-4 mt-3 overflow-x-auto pb-1">
            {sections.map((section) => {
              const sectionQuestions = questions.filter((q) => q.section === section);
              const firstIdx = questions.findIndex((q) => q.section === section);
              const done = sectionQuestions.every((q) => answers[q.id] !== undefined);
              return (
                <button
                  key={section}
                  onClick={() => setCurrentIndex(firstIdx)}
                  className={`text-xs font-medium whitespace-nowrap pb-1 border-b-2 transition-colors ${
                    section === currentSection
                      ? "border-primary text-primary"
                      : done
                      ? "border-primary/30 text-muted-foreground"
                      : "border-transparent text-muted-foreground/50"
                  }`}
                >
                  {section}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Question */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl animate-fade-up" key={currentIndex}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {currentQ.section}
          </p>
          <h2 className="font-display text-xl font-semibold mb-6 leading-snug">{currentQ.question}</h2>

          {currentQ.type === "multi" && (
            <p className="text-sm text-muted-foreground mb-4">Select all that apply</p>
          )}

          <div className={`grid gap-2.5 ${currentQ.options.length > 5 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            {currentQ.options.map((option) => {
              const isSelected = currentQ.type === "single"
                ? currentAnswer === option
                : (currentAnswer as string[] ?? []).includes(option);

              return (
                <button
                  key={option}
                  data-testid={`option-${option.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => currentQ.type === "single" ? handleSingle(option) : handleMulti(option)}
                  className={`option-card animate-fade-up text-left flex items-center gap-3 ${isSelected ? "selected" : ""}`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                    isSelected ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {isSelected && (
                      <svg viewBox="0 0 8 8" fill="white" className="w-full h-full p-0.5">
                        <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Navigation */}
      <footer className="border-t border-border/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentIndex === 0}
            data-testid="button-quiz-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isAnswered || submitMutation.isPending}
            className="font-semibold px-6"
            data-testid="button-quiz-next"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Matching…</>
            ) : currentIndex === totalQ - 1 ? (
              "Find my tribe →"
            ) : (
              <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
