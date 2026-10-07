import { Check, CheckCheck, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read';

const labels: Record<DeliveryStatus, string> = {
  pending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

/** Ticks never rely on colour alone: the icon changes shape and carries a label. */
export function Ticks({ status, className }: { status: DeliveryStatus; className?: string }) {
  const Icon = status === 'pending' ? Clock3 : status === 'sent' ? Check : CheckCheck;
  return (
    <span role="img" aria-label={labels[status]} className={cn('inline-flex', className)}>
      <Icon
        strokeWidth={2.5}
        className={cn('size-3.5', status === 'read' ? 'text-periwinkle' : 'opacity-70')}
      />
    </span>
  );
}
