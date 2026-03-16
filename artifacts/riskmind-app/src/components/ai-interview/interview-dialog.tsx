import { useState, useRef, useEffect, useCallback } from "react";
import { useStartInterview, useAbandonInterview } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface DraftData {
  title?: string;
  description?: string;
  category?: string;
  likelihood?: number;
  impact?: number;
  result?: string;
  notes?: string;
  gaps?: string[];
}

interface InterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "risk_creation" | "control_assessment";
  controlId?: string;
  title?: string;
  description?: string;
  onCommitted?: (resultId: string | null, type: string) => void;
}

function parseAiMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "question" && parsed.content) return parsed.content;
    if (parsed.type === "draft") return "I've gathered enough information to create a draft. Review it below and click **Commit** to save.";
    return raw;
  } catch {
    return raw;
  }
}

function ChatBubble({ entry }: { entry: TranscriptEntry }) {
  const isAI = entry.role === "assistant";
  const text = isAI ? parseAiMessage(entry.content) : entry.content;

  return (
    <div className={cn("flex gap-3 items-start", isAI ? "flex-row" : "flex-row-reverse")}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
        isAI ? "bg-foreground text-background" : "bg-secondary text-foreground"
      )}>
        {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
        isAI
          ? "bg-muted border rounded-tl-none"
          : "bg-foreground text-background rounded-tr-none"
      )}>
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-foreground text-background">
        <Bot className="h-4 w-4" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-muted border">
        <div className="flex gap-1 items-center h-5">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-foreground text-background">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-none bg-muted border text-sm leading-relaxed">
        {parseAiMessage(text) || <span className="opacity-50">Thinking…</span>}
        <span className="inline-block w-0.5 h-3.5 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
      </div>
    </div>
  );
}

function DraftPanel({ draft, type, onCommit, onContinue, isCommitting }: {
  draft: DraftData;
  type: string;
  onCommit: () => void;
  onContinue: () => void;
  isCommitting: boolean;
}) {
  return (
    <div className="border border-foreground/20 rounded-xl bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4" />
        Draft Ready
        <Badge variant="outline" className="text-[10px] ml-auto">Review before saving</Badge>
      </div>
      <div className="space-y-2 text-sm">
        {type === "risk_creation" && (
          <>
            {draft.title && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Title</span><div className="font-medium mt-0.5">{draft.title}</div></div>}
            {draft.description && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Description</span><div className="mt-0.5 text-muted-foreground">{draft.description}</div></div>}
            <div className="flex gap-4">
              {draft.category && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Category</span><div className="font-medium mt-0.5 capitalize">{draft.category}</div></div>}
              {draft.likelihood && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Likelihood</span><div className="font-medium mt-0.5">{draft.likelihood}/5</div></div>}
              {draft.impact && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Impact</span><div className="font-medium mt-0.5">{draft.impact}/5</div></div>}
            </div>
          </>
        )}
        {type === "control_assessment" && (
          <>
            {draft.result && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Result</span><div className="font-medium mt-0.5 capitalize">{draft.result?.replace("_", " ")}</div></div>}
            {draft.notes && <div><span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Notes</span><div className="mt-0.5 text-muted-foreground">{draft.notes}</div></div>}
            {draft.gaps && draft.gaps.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs uppercase font-mono tracking-wide">Gaps</span>
                <ul className="mt-1 space-y-1">
                  {draft.gaps.map((g, i) => (
                    <li key={i} className="text-xs text-destructive flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex gap-2 pt-2 border-t border-foreground/10">
        <Button size="sm" onClick={onCommit} disabled={isCommitting} className="flex-1">
          {isCommitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          {type === "risk_creation" ? "Create Risk" : "Save Assessment"}
        </Button>
        <Button size="sm" variant="outline" onClick={onContinue} disabled={isCommitting}>
          Refine
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export function InterviewDialog({
  open,
  onOpenChange,
  type,
  controlId,
  title,
  description,
  onCommitted,
}: InterviewDialogProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isCommitting, setIsCommitting] = useState(false);
  const startMutation = useStartInterview();
  const abandonMutation = useAbandonInterview();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [transcript, streamingText, scrollToBottom]);

  useEffect(() => {
    if (open && !sessionId) {
      setIsStarting(true);
      setError(null);
      setCommitted(false);
      setDraftData(null);
      setShowDraft(false);
      setTranscript([]);

      startMutation.mutate(
        { data: { type } },
        {
          onSuccess: (session: { id?: string; transcript?: TranscriptEntry[] }) => {
            setSessionId(session.id || null);
            setTranscript((session.transcript as TranscriptEntry[]) || []);
            setIsStarting(false);
            setTimeout(() => inputRef.current?.focus(), 100);
          },
          onError: (err: Error & { detail?: string; title?: string }) => {
            const msg =
              (err as { detail?: string })?.detail ||
              err.message ||
              "AI unavailable. Configure an LLM provider in Settings to use interview mode.";
            setError(msg);
            setIsStarting(false);
          },
        }
      );
    }
    if (!open) {
      setSessionId(null);
      setTranscript([]);
      setStreamingText("");
      setDraftData(null);
      setShowDraft(false);
      setError(null);
      setCommitted(false);
    }
  }, [open, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !sessionId || isStreaming) return;
    const content = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);
    setStreamingText("");
    setShowDraft(false);

    setTranscript((prev) => [
      ...prev,
      { role: "user", content, timestamp: new Date().toISOString() },
    ]);

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/v1/ai/interview/${sessionId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Stream error" }));
        throw new Error(errData.detail || errData.message || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let finalDraft: DraftData | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw) as { type: string; content?: string; draftData?: DraftData };
            if (evt.type === "text" && evt.content) {
              fullText += evt.content;
              setStreamingText(fullText);
            } else if (evt.type === "done") {
              if (evt.draftData && Object.keys(evt.draftData).length > 0) {
                finalDraft = evt.draftData;
              }
            } else if (evt.type === "error") {
              throw new Error(evt.content || "Stream error");
            }
          } catch {
            // ignore parse errors in individual SSE events
          }
        }
      }

      setStreamingText("");
      const aiEntry: TranscriptEntry = {
        role: "assistant",
        content: fullText,
        timestamp: new Date().toISOString(),
      };
      setTranscript((prev) => [...prev, aiEntry]);

      if (finalDraft) {
        setDraftData(finalDraft);
        setShowDraft(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setTranscript((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `{"type":"question","content":"Sorry, I encountered an error: ${msg}. Please try again."}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, sessionId, isStreaming]);

  const handleCommit = useCallback(async () => {
    if (!sessionId || isCommitting) return;
    setIsCommitting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/v1/ai/interview/${sessionId}/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(controlId ? { controlId } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Commit failed" }));
        throw new Error(err.detail || err.message || `HTTP ${res.status}`);
      }
      const result = await res.json() as { status: string; resultId?: string | null; type: string };
      setCommitted(true);
      onCommitted?.(result.resultId ?? null, result.type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    } finally {
      setIsCommitting(false);
    }
  }, [sessionId, controlId, isCommitting, onCommitted]);

  const handleAbandon = useCallback(() => {
    if (sessionId && !committed) {
      abandonMutation.mutate({ sessionId });
    }
    onOpenChange(false);
  }, [sessionId, committed, abandonMutation, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const dialogTitle = title || (type === "risk_creation" ? "Create Risk with AI" : "Assess Control with AI");
  const dialogDesc = description || (
    type === "risk_creation"
      ? "Answer a few questions and the AI will draft a risk record for you."
      : "Walk through a structured assessment and AI will generate an evaluation."
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleAbandon(); }}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-foreground text-background flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">{dialogTitle}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">{dialogDesc}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {isStarting && (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Starting AI interview session…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-sm">AI Unavailable</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          )}

          {committed && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <div>
                <p className="font-semibold">
                  {type === "risk_creation" ? "Risk created successfully!" : "Assessment saved!"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">The record has been added to the register.</p>
              </div>
              <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          )}

          {!isStarting && !error && !committed && (
            <>
              {transcript.map((entry, i) => (
                <ChatBubble key={i} entry={entry} />
              ))}
              {isStreaming && !streamingText && <TypingIndicator />}
              {isStreaming && streamingText && <StreamingBubble text={streamingText} />}
              {showDraft && draftData && (
                <DraftPanel
                  draft={draftData}
                  type={type}
                  onCommit={handleCommit}
                  onContinue={() => setShowDraft(false)}
                  isCommitting={isCommitting}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {!isStarting && !error && !committed && (
          <div className="border-t px-4 py-3">
            <div className="flex gap-2 items-center">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response…"
                disabled={isStreaming || !sessionId}
                className="flex-1 h-10 text-sm"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isStreaming || !inputValue.trim() || !sessionId}
                className="h-10 w-10 shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Press Enter to send · Shift+Enter for new line · <button className="underline hover:text-foreground" onClick={handleAbandon}>Cancel session</button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
