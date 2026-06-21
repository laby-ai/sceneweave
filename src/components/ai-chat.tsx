'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { 
  Send, 
  Bot, 
  User, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles,
  Loader2
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const QUICK_PROMPTS = [
  '帮我写一段代码',
  '解释一下这个概念',
  '帮我翻译一下',
  '给我一些建议',
  '讲个笑话吧',
];

export function AIChat() {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [] as Message[],
      createdAt: Date.now(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(sessions.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      if (sessions.length > 1) {
        const otherSession = sessions.find(s => s.id !== sessionId);
        if (otherSession) {
          loadSession(otherSession);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // 如果是新会话，创建会话
    if (!currentSessionId) {
      createNewSession();
    }

    try {
      // 模拟AI回复
      await new Promise(resolve => setTimeout(resolve, 1000));

      const responses = [
        `好的，我来帮你处理"${userMessage.content}"这个问题。`,
        `这是一个很有趣的话题！关于"${userMessage.content}"，我有一些想法...`,
        `让我想想如何回答"${userMessage.content}"这个问题...`,
        `感谢你的提问！"${userMessage.content}"确实值得深入探讨。`,
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const fullResponse = `${randomResponse}\n\n这是一个模拟的AI回复，实际应用中会连接真实的AI服务来提供智能回答。你可以继续提问，我会尽力帮助你！`;

      let currentText = '';
      const chars = fullResponse.split('');
      
      for (let i = 0; i < chars.length; i++) {
        currentText += chars[i];
        
        // 更新最后一条消息
        const assistantMessage: Message = {
          id: (Date.now() + i).toString(),
          role: 'assistant',
          content: currentText,
          timestamp: Date.now(),
        };

        setMessages([...newMessages, assistantMessage]);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // 更新会话
      const finalMessages = [...newMessages, {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: fullResponse,
        timestamp: Date.now(),
      }];

      if (currentSessionId) {
        setSessions(sessions.map(s => 
          s.id === currentSessionId 
            ? { ...s, messages: finalMessages, title: userMessage.content.slice(0, 30) }
            : s
        ));
      }

    } catch (error) {
      console.error('发送失败:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
      {/* Sidebar - Sessions */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">对话历史</CardTitle>
              <Button size="sm" variant="secondary" onClick={createNewSession}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2">
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">暂无对话</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    currentSessionId === session.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(session.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => deleteSession(e, session.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Area */}
      <div className="lg:col-span-3 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">AI 助手</CardTitle>
                <CardDescription className="text-xs">随时为您提供帮助</CardDescription>
              </div>
              <div className="ml-auto">
                <Sparkles className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-purple-600/20 flex items-center justify-center">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">您好！有什么可以帮助您的？</h3>
                  <p className="text-muted-foreground text-sm">
                    选择一个快捷提示或直接输入您的问题
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {QUICK_PROMPTS.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleQuickPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="w-8 h-8 shrink-0">
                        <div className="w-full h-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="w-8 h-8 shrink-0">
                        <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0">
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    </Avatar>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>

          <CardContent className="border-t pt-4">
            <div className="flex gap-2">
              <Input
                placeholder="输入您的问题..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={isTyping}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
              >
                {isTyping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
