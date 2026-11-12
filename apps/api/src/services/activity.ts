import { db } from '../db.js';
import type { Prisma } from '@prisma/client';
export const logActivity = (
  action: string,
  data: {
    businessId?: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    metadata?: object;
  },
) => db.activityLog.create({ data: { action, ...data } }).catch(() => undefined);

export const logActivityStrict = (
  tx: Prisma.TransactionClient,
  action: string,
  data: {
    businessId?: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) => tx.activityLog.create({ data: { action, ...data } });
