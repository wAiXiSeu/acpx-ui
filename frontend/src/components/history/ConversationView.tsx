import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { SessionRecord, SessionMessage, SessionUserContent, SessionAgentContent, SessionToolUse, SessionToolResult } from "../../types/acpx";

interface ConversationViewProps {
  session: SessionRecord;
  history: SessionMessage[];
}

interface MessageBlock {
  id: string;
  role: "user" | "agent";
  content: ContentBlock[];
  timestamp?: string;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: string; width?: number; height?: number }
  | { type: "tool_use"; tool: SessionToolUse }
  | { type: "tool_result"; result: SessionToolResult }
  | { type: "thinking"; text: string }
  | { type: "mention"; uri: string; content: string };

function processUserContent(content: SessionUserContent[]): ContentBlock[] {
  return content.map((item) => {
    if ("Text" in item) {
      return { type: "text", text: item.Text };
    } else if ("Image" in item) {
      return {
        type: "image",
        source: item.Image.source,
        width: item.Image.size?.width,
        height: item.Image.size?.height,
      };
    } else if ("Mention" in item) {
      return {
        type: "mention",
        uri: item.Mention.uri,
        content: item.Mention.content,
      };
    }
    return { type: "text", text: "" };
  });
}

function processAgentContent(content: SessionAgentContent[]): ContentBlock[] {
  return content.map((item) => {
    if ("Text" in item) {
      return { type: "text", text: item.Text };
    } else if ("Thinking" in item) {
      return { type: "thinking", text: item.Thinking.text };
    } else if ("ToolUse" in item) {
      return { type: "tool_use", tool: item.ToolUse };
    }
    return { type: "text", text: "" };
  });
}

function extractMessages(history: SessionMessage[]): MessageBlock[] {
  const messages: MessageBlock[] = [];

  history.forEach((msg, idx) => {
    if (msg === "Resume") {
      messages.push({
        id: `resume-${idx}`,
        role: "agent",
        content: [{ type: "text", text: "*Session resumed*" }],
      });
      return;
    }

    if ("User" in msg) {
      messages.push({
        id: msg.User.id || `user-${idx}`,
        role: "user",
        content: processUserContent(msg.User.content),
      });
    } else if ("Agent" in msg) {
      const agentContent = processAgentContent(msg.Agent.content);

      Object.entries(msg.Agent.tool_results).forEach(([, result]) => {
        agentContent.push({
          type: "tool_result",
          result: result as SessionToolResult,
        });
      });

      messages.push({
        id: `agent-${idx}`,
        role: "agent",
        content: agentContent,
      });
    }
  });

  return messages;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-900 border-b border-surface-700 rounded-t-lg">
        <span className="text-text-muted text-xs font-mono">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="text-text-muted hover:text-text-primary text-xs flex items-center gap-1 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 0.5rem 0.5rem",
          fontSize: "0.875rem",
          background: "#12121a",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolUseBlock({ tool }: { tool: SessionToolUse }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 bg-accent-warning/10 border border-accent-warning/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent-warning/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-accent-warning text-sm font-medium">{tool.name}</span>
        </div>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <pre className="text-xs text-text-secondary font-mono bg-surface-900 rounded p-2 overflow-auto">
            {tool.raw_input}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolResultBlock({ result }: { result: SessionToolResult }) {
  const [expanded, setExpanded] = useState(false);

  const getContent = (): string => {
    if ("Text" in result.content) {
      return result.content.Text;
    } else if ("Image" in result.content) {
      return "[Image result]";
    }
    return "";
  };

  return (
    <div className={`my-3 border rounded-lg overflow-hidden ${result.is_error ? "bg-accent-error/10 border-accent-error/30" : "bg-accent-success/10 border-accent-success/30"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${
          result.is_error ? "hover:bg-accent-error/5" : "hover:bg-accent-success/5"
        }`}
      >
        <div className="flex items-center gap-2">
          {result.is_error ? (
            <svg className="w-4 h-4 text-accent-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-accent-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`text-sm font-medium ${result.is_error ? "text-accent-error" : "text-accent-success"}`}>
            {result.tool_name} {result.is_error ? "(Error)" : "(Success)"}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <pre className="text-xs text-text-secondary font-mono bg-surface-900 rounded p-2 overflow-auto max-h-64">
            {getContent()}
          </pre>
        </div>
      )}
    </div>
  );
}

function MessageContent({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "text":
            return (
              <div key={idx} className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    code({ className, children }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const code = String(children).replace(/\n$/, "");
                      return <CodeBlock language={language} code={code} />;
                    },
                    pre({ children }) {
                      return <>{children}</>;
                    },
                  }}
                >
                  {block.text}
                </ReactMarkdown>
              </div>
            );
          case "image":
            return (
              <div key={idx} className="my-3">
                <img
                  src={block.source}
                  alt="User uploaded"
                  className="max-w-full max-h-96 rounded-lg border border-surface-600"
                  style={{
                    width: block.width ? `${block.width}px` : "auto",
                    height: block.height ? `${block.height}px` : "auto",
                  }}
                />
              </div>
            );
          case "mention":
            return (
              <div key={idx} className="my-2 p-2 bg-accent-secondary/10 border border-accent-secondary/30 rounded-lg">
                <div className="flex items-center gap-2 text-accent-secondary text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="font-medium">{block.uri}</span>
                </div>
                <p className="text-text-secondary text-xs mt-1">{block.content}</p>
              </div>
            );
          case "tool_use":
            return <ToolUseBlock key={idx} tool={block.tool} />;
          case "tool_result":
            return <ToolResultBlock key={idx} result={block.result} />;
          case "thinking":
            return (
              <div key={idx} className="my-2 p-3 bg-surface-700/50 border border-surface-600 rounded-lg">
                <div className="flex items-center gap-2 text-text-muted text-xs mb-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Thinking</span>
                </div>
                <p className="text-text-secondary text-sm italic">{block.text}</p>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

export default function ConversationView({ session, history }: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = extractMessages(history);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  if (messages.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-text-primary font-semibold text-lg mb-2">No messages yet</h3>
        <p className="text-text-muted text-sm">This session has no conversation history.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] ${
                message.role === "user"
                  ? "bg-accent-info text-white rounded-2xl rounded-tr-sm"
                  : "bg-surface-700 text-text-primary rounded-2xl rounded-tl-sm"
              } px-4 py-3`}
            >
              <MessageContent blocks={message.content} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-surface-700 p-4 bg-surface-800/50">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{messages.length} messages</span>
          <span>Session: {session.acpxRecordId.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  );
}
