'use client';

import { MessagesSquare } from 'lucide-react';

/** Desktop right pane before a chat is picked (mobile shows the list instead). */
export default function Home() {
  return (
    <div className="flex h-dvh flex-col items-start justify-end bg-cream p-10 text-ink">
      <span className="flex size-fab items-center justify-center rounded-pill bg-ink text-cream">
        <MessagesSquare className="size-7" />
      </span>
      <h2 className="mt-6 text-display-desktop">
        Pick a chat
        <br />
        to dive in
      </h2>
      <p className="mt-3 max-w-sm text-body text-muted">Everything you send rides Kafka on Aiven and lands on every device in real time.</p>
    </div>
  );
}
