import React, { useEffect, useRef, useState } from 'react';

export interface FilmEditableFieldProps {
  cardId: string;
  field: string;
  value: string | undefined;
  label?: string;
  className?: string;
  multiline?: boolean;
  onUpdate: (cardId: string, field: string, value: string) => void;
}

export function FilmEditableField({
  cardId,
  field,
  value,
  label,
  className = '',
  multiline = false,
  onUpdate,
}: FilmEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const displayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  useEffect(() => {
    if (editing && multiline && displayRef.current && textareaRef.current) {
      textareaRef.current.style.height = displayRef.current.scrollHeight + 'px';
    }
  }, [editing, multiline, value]);

  const commit = () => {
    onUpdate(cardId, field, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-0.5">
        {label && <div className="text-[10px] text-foreground/30">{label}</div>}
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={event => {
              setDraft(event.target.value);
              event.target.style.height = 'auto';
              event.target.style.height = event.target.scrollHeight + 'px';
            }}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setDraft(value || '');
                setEditing(false);
              }
            }}
            autoFocus
            className="w-full text-[10px] bg-primary/5 border border-primary/20 rounded px-1.5 py-1 resize-none focus:outline-none focus:border-primary/40 text-foreground/80 overflow-hidden"
            style={{ minHeight: displayRef.current ? displayRef.current.scrollHeight + 'px' : '40px' }}
          />
        ) : (
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setDraft(value || '');
                setEditing(false);
              }
              if (event.key === 'Enter') {
                commit();
              }
            }}
            autoFocus
            className="w-full text-[10px] bg-primary/5 border border-primary/20 rounded px-1.5 py-1 focus:outline-none focus:border-primary/40 text-foreground/80"
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={displayRef}
      onDoubleClick={() => setEditing(true)}
      className={`cursor-text rounded px-1 -mx-1 hover:bg-primary/5 transition-colors group/edit ${className}`}
      title="双击编辑"
    >
      {label && <span className="text-foreground/30">{label}</span>}
      <span className="text-foreground/60">{value || <span className="text-foreground/20 italic text-[9px]">双击编辑</span>}</span>
    </div>
  );
}
