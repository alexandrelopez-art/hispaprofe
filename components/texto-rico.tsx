"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza el texto de un bloque escrito en Markdown.
 * No admite HTML crudo a proposito: lo que escribe el profesor acaba en la
 * pagina del estudiante, y limitarlo a Markdown evita tener que vigilar
 * que no se cuele nada raro.
 */
export default function TextoRico({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-3 leading-relaxed text-tinta last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-extrabold text-tinta">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => (
          <h3 className="mb-2 mt-4 text-xl font-extrabold text-tinta first:mt-0">
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h4 className="mb-2 mt-4 text-lg font-bold text-tinta first:mt-0">
            {children}
          </h4>
        ),
        h3: ({ children }) => (
          <h5 className="mb-1 mt-3 text-base font-bold text-tinta first:mt-0">
            {children}
          </h5>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 ml-5 list-disc space-y-1 text-tinta">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-5 list-decimal space-y-1 text-tinta">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-hp-600 underline hover:text-hp-500"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-4 border-hp-200 pl-4 italic text-tinta-suave">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-hp-50 px-1.5 py-0.5 font-mono text-sm text-tinta">
            {children}
          </code>
        ),
        hr: () => <hr className="my-4 border-hp-100" />,
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-hp-50">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-hp-100 px-3 py-2 text-left font-bold text-tinta">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-hp-100 px-3 py-2 text-tinta">
            {children}
          </td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
