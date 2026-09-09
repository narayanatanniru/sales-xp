import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Send, Bot, User as UserIcon, Sparkles,
  LayoutDashboard, Zap, Loader2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: { name: string; status: 'pending' | 'done' }[];
}

export default function EarnieAssistant() {
  const { user } = useAuth();
  const role = user?.role ?? 'user';
  const isTeamLead = role === 'team-lead';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Sales Assistant
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your AI-powered assistant for managing sales performance.
        </p>
      </div>

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-1" /> Agent E</TabsTrigger>
          {isTeamLead && (
            <TabsTrigger value="autopilot"><Zap className="h-4 w-4 mr-1" /> Autopilot</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard"><DashboardView /></TabsContent>
        <TabsContent value="chat"><ChatView /></TabsContent>
        {isTeamLead && <TabsContent value="autopilot"><AutopilotView /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Company goal progress and team target breakdowns will appear here.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your envelope balance and spending breakdown for the current cycle.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            What to do today — your daily recommended play based on team gaps.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Contribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coins won and plays won per team this period.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Chat View (Agent E) ───────────────────────────────────────────────────────

function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiRequest<{ suggestions: string[] }>('/chatbot/suggestions')
      .then(data => setSuggestions(data.suggestions))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const response = await apiRequest<{ message: string }>('/chatbot/message', {
        method: 'POST',
        body: { message: text.trim() },
      });
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Agent E</CardTitle>
            <Badge variant="secondary" className="text-xs">Claude-powered</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <ScrollArea className="flex-1 px-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <Sparkles className="h-12 w-12 text-primary/30 mb-4" />
                <p className="text-lg font-medium">How can I help?</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  I can answer questions, manage challenges, create battles, adjust KPIs,
                  and perform admin actions — all with confirmation before any changes.
                </p>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6 max-w-lg">
                    {suggestions.map((s, i) => (
                      <Button key={i} variant="outline" size="sm" onClick={() => sendMessage(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <UserIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4 shrink-0">
            <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask Agent E anything..."
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Autopilot View ────────────────────────────────────────────────────────────

function AutopilotView() {
  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" /> Autopilot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When enabled, Earnie automatically plans and launches plays for your team every day.
            It uses 60% of your daily allowance in the morning wave and tops up the rest intra-day.
          </p>
          <div className="flex items-center gap-4">
            <Badge variant="outline">Status: Off</Badge>
            <Button size="sm">Enable Autopilot</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's Plays</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No autopilot plays today. Enable Autopilot or use "Run Now" to generate plays.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
