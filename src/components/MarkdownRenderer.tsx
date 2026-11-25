import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import { Check, Copy, Eye, Code2 } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const highlightedHtml = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [code, language]);

  const isHtmlPreviewable =
    language.toLowerCase() === 'html' &&
    (code.includes('<html') || code.includes('<body') || code.includes('<div') || code.includes('<style'));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-[#0d1322] dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#131b2e] px-3.5 py-2 text-xs text-slate-300">
        <span className="font-mono font-medium lowercase text-cyan-300">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-2">
          {isHtmlPreviewable && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
            >
              {showPreview ? <Code2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showPreview ? 'Code' : 'Preview'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${language || 'code'} snippet`}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      {showPreview ? (
        <iframe
          title="HTML Code Preview"
          srcDoc={code}
          sandbox="allow-scripts"
          className="h-80 w-full bg-white"
        />
      ) : (
        <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
          <code
            className="hljs font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      )}
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-sm max-w-none break-words text-slate-800 dark:text-slate-100 prose-headings:font-display prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-white prose-p:leading-relaxed prose-a:text-indigo-600 dark:prose-a:text-cyan-400 prose-strong:text-slate-900 dark:prose-strong:text-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const rawCode = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawCode.includes('\n');

            if (isBlock) {
              return <CodeBlock language={match?.[1] || ''} code={rawCode} />;
            }

            return (
              <code
                className="rounded-md bg-slate-200/80 px-1.5 py-0.5 font-mono text-[12.5px] text-indigo-700 dark:bg-slate-800 dark:text-cyan-300"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-slate-200 bg-slate-100 px-3 py-2 font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-slate-100 px-3 py-2 text-slate-700 dark:border-slate-800/60 dark:text-slate-300">
                {children}
              </td>
            );
          },
          ul({ children }) {
            return <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>;
          },
          h1({ children }) {
            return <h1 className="mt-4 mb-2 text-xl font-bold">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mt-4 mb-2 text-lg font-semibold">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mt-3 mb-1.5 text-base font-semibold">{children}</h3>;
          },
          p({ children }) {
            return <p className="my-2 leading-relaxed">{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
