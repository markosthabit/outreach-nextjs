import mongoose, { Schema, Types, HydratedDocument } from 'mongoose'

export interface IOutreachRound {
  cycleId: Types.ObjectId
  name: string
  startDate: Date
  endDate: Date
  status: 'active' | 'completed'
  createdBy: Types.ObjectId
}

export type OutreachRoundDocument = HydratedDocument<IOutreachRound>

const OutreachRoundSchema = new Schema<IOutreachRound>(
  {
    cycleId: { type: Schema.Types.ObjectId, ref: 'OutreachCycle', required: true, index: true },
    name: { type: String, required: [true, 'Round name is required'], trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { collection: 'outreach_rounds', timestamps: true }
)

export const OutreachRound =
  mongoose.models.OutreachRound || mongoose.model<IOutreachRound>('OutreachRound', OutreachRoundSchema)
