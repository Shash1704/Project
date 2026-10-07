import { monotonicFactory } from 'ulid';

const next = monotonicFactory();

/** Monotonic ULID — sortable by creation time even within the same millisecond. */
export const newId = (time?: number): string => next(time);

/** MySQL DATETIME(3) from an ISO string or Date. */
export const toSqlDate = (d: string | Date): Date => (typeof d === 'string' ? new Date(d) : d);
