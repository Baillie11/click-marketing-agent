import { db } from '../db.js';
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
