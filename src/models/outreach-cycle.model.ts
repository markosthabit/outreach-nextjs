import mongoose, { Schema, Types, HydratedDocument } from 'mongoose'

export interface IOutreachCycle {
  name: string
  status: 'active' | 'completed'
  startedAt: Date
  endedAt?: Date | null
  createdBy: Types.ObjectId
}

export type OutreachCycleDocument = HydratedDocument<IOutreachCycle>

const OutreachCycleSchema = new Schema<IOutreachCycle>(
  {
    name: { type: String, required: [true, 'Cycle name is required'], trim: true },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { collection: 'outreach_cycles', timestamps: true }
)

export const OutreachCycle =
  mongoose.models.OutreachCycle || mongoose.model<IOutreachCycle>('OutreachCycle', OutreachCycleSchema)
