/**
 * Tick state for a sender's messages from member watermarks: a message is delivered/read once
 * *every* other member's watermark has reached it.
 */
export function tickFor(
  messageId: string,
  senderId: string,
  marks: { userId: string; delivered: string | null; read: string | null }[],
): 'sent' | 'delivered' | 'read' {
  const others = marks.filter((w) => w.userId !== senderId);
  if (!others.length) return 'sent';
  if (others.every((w) => w.read !== null && w.read >= messageId)) return 'read';
  if (
    others.every(
      (w) =>
        (w.delivered !== null && w.delivered >= messageId) ||
        (w.read !== null && w.read >= messageId),
    )
  )
    return 'delivered';
  return 'sent';
}
