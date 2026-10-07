'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Camera, ListChecks, PenLine, Plus } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

export type ComposerTool = 'attach' | 'camera' | 'tone' | 'replies';

export interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onTool?: (tool: ComposerTool) => void;
  onTyping?: () => void;
  activeTool?: ComposerTool | null;
  disabled?: boolean;
  above?: React.ReactNode;
}

/** "Tap here to type…" line with a thin caret marker, above a pill toolbar of circles. */
export function Composer({
  value,
  onChange,
  onSend,
  onTool,
  onTyping,
  activeTool,
  disabled,
  above,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="px-screen pt-2 pb-[max(env(safe-area-inset-bottom),16px)]">
      {above}
      <label className="flex items-start gap-2">
        <span aria-hidden className="mt-1.5 h-6 w-0.5 shrink-0 rounded-pill bg-ink" />
        <span className="sr-only">Message</span>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder="Tap here to type…"
          onChange={(e) => {
            onChange(e.target.value);
            onTyping?.();
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1 text-title leading-tight text-ink outline-none placeholder:text-muted"
        />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <IconButton label="Attach" tone="primary" onClick={() => onTool?.('attach')}>
          <Plus />
        </IconButton>
        <IconButton label="Camera" onClick={() => onTool?.('camera')}>
          <Camera />
        </IconButton>
        <IconButton
          label="Tone check"
          tone={activeTool === 'tone' ? 'ai' : 'secondary'}
          aria-pressed={activeTool === 'tone'}
          onClick={() => onTool?.('tone')}
        >
          <PenLine />
        </IconButton>
        <IconButton
          label="Smart replies"
          tone={activeTool === 'replies' ? 'ai' : 'secondary'}
          aria-pressed={activeTool === 'replies'}
          onClick={() => onTool?.('replies')}
        >
          <ListChecks />
        </IconButton>
        <AnimatePresence>
          {canSend && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="ml-auto"
            >
              <IconButton label="Send" tone="primary" size="lg" onClick={onSend} className={cn()}>
                <ArrowUp className="!size-6" strokeWidth={2.5} />
              </IconButton>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
