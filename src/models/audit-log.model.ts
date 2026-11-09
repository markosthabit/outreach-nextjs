import mongoose, { Schema, Types } from 'mongoose'

export type AuditAction =
  | 'backup.data.download'
  | 'backup.users.download'
  | 'restore.data'
  | 'restore.users'

export interface IAuditLog {
  action: AuditAction
  status: 'success' | 'failure'
  actorId: Types.ObjectId
  /** Snapshot of the actor's name/email, so the log stays readable if the user is later deleted */
  actorName: string
  actorEmail: string
  ip: string
  details?: Record<string, unknown>
  createdAt?: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    status: { type: String, enum: ['success', 'failure'], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
    ip: { type: String, default: '' },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  // Audit logs are never part of a data backup/restore, so a restore can't erase them
  { collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } }
)

AuditLogSchema.index({ createdAt: -1 })

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
