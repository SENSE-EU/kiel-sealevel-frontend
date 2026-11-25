import type { ReactNode } from 'react';
import type {
  BlockNode,
  InlineNode,
  RichText as RichTextValue,
} from '@/content/types';

const SAFE_URL = /^(https?:|mailto:|\/)/i;

function renderInline(nodes: InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === 'link') {
      const children = renderInline(node.children);
      return SAFE_URL.test(node.url) ? (
        <a
          key={index}
          href={node.url}
          className="text-foam underline decoration-signal/50 underline-offset-[3px] transition-colors hover:text-signal hover:decoration-signal"
          rel="noreferrer"
          target="_blank"
        >
          {children}
        </a>
      ) : (
        <span key={index}>{children}</span>
      );
    }
    let content: ReactNode = node.text;
    if (node.code) content = <code>{content}</code>;
    if (node.bold) content = <strong>{content}</strong>;
    if (node.italic) content = <em>{content}</em>;
    if (node.underline) content = <u>{content}</u>;
    if (node.strikethrough) content = <s>{content}</s>;
    return <span key={index}>{content}</span>;
  });
}

function renderBlock(block: BlockNode, index: number): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return <p key={index}>{renderInline(block.children)}</p>;
    case 'heading':
      // The panel title is the h2, so body headings start one level below it.
      return (
        <h3 key={index} className="pt-1 display text-lg font-normal text-foam">
          {renderInline(block.children)}
        </h3>
      );
    case 'quote':
      return (
        <blockquote
          key={index}
          className="border-l-2 border-signal/50 pl-3.5 display text-[1.0625rem] text-foam/90 italic"
        >
          {renderInline(block.children)}
        </blockquote>
      );
    case 'code':
      return (
        <pre key={index} className="overflow-x-auto font-mono text-[0.8125rem]">
          {renderInline(block.children)}
        </pre>
      );
    case 'list': {
      const List = block.format === 'ordered' ? 'ol' : 'ul';
      const marker = block.format === 'ordered' ? 'list-decimal' : 'list-disc';
      return (
        <List key={index} className={`${marker} pl-5`}>
          {block.children.map(renderBlock)}
        </List>
      );
    }
    case 'list-item':
      return <li key={index}>{renderInline(block.children)}</li>;
    case 'image':
      return (
        <img
          key={index}
          src={block.image.url}
          alt={block.image.alternativeText ?? ''}
        />
      );
    default:
      return null;
  }
}

export function RichText({ value }: { value: RichTextValue }) {
  const blocks =
    typeof value === 'string'
      ? value
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((text, index) => <p key={index}>{text}</p>)
      : value.map(renderBlock);
  return (
    <div className="space-y-3.5 text-[0.9375rem] leading-[1.6] text-pretty text-foam/85 [&_strong]:font-medium [&_strong]:text-foam">
      {blocks}
    </div>
  );
}
