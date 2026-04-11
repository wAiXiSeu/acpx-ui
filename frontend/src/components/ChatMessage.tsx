import ReactMarkdown from "react-markdown";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MarkdownComponent = ReactMarkdown as any;
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatMessageProps {
  role: "user" | "agent";
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function CodeBlock({
  language,
  code,
}: {
  language: string | undefined;
  code: string;
}) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-surface-600">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-900 border-b border-surface-700">
        <span className="text-text-muted text-xs font-mono">
          {language || "text"}
        </span>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          background: "#12121a",
          fontSize: "0.875rem",
          padding: "0.75rem",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5 text-text-muted text-sm">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
        .
      </span>
      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
        .
      </span>
    </span>
  );
}

export default function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-accent-info text-white rounded-tr-sm"
            : "bg-surface-700 text-text-primary rounded-tl-sm"
        }`}
      >
        {/* Timestamp */}
        {timestamp && (
          <div
            className={`text-xs mb-1 ${
              isUser ? "text-white/60" : "text-text-muted"
            }`}
          >
            {formatTimestamp(timestamp)}
          </div>
        )}

        {/* Message body */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {content}
          </div>
        ) : (
          <div>
            {content ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <MarkdownComponent
                  components={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    code({ className, children, ...rest }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const codeText = String(children).replace(/\n$/, "");

                      // Inline code (no language, single line, no className from fence)
                      if (!className && !codeText.includes("\n")) {
                        return (
                          <code
                            className="bg-surface-900 text-accent-secondary px-1.5 py-0.5 rounded text-sm font-mono"
                            {...rest}
                          >
                            {codeText}
                          </code>
                        );
                      }

                      return <CodeBlock language={language} code={codeText} />;
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pre({ children }: any) {
                      // Let the code component handle the wrapper
                      return <>{children}</>;
                    },
                  }}
                >
                  {content}
                </MarkdownComponent>
              </div>
            ) : isStreaming ? (
              <StreamingIndicator />
            ) : null}

            {/* Show streaming dots even when there is partial content */}
            {content && isStreaming && (
              <div className="mt-2">
                <StreamingIndicator />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
