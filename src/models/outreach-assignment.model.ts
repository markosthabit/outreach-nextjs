import mongoose, { Schema, Types, HydratedDocument } from 'mongoose'

export interface IOutreachAssignment {
  cycleId: Types.ObjectId
  roundId: Types.ObjectId
  servantId: Types.ObjectId
  servanteeId: Types.ObjectId
  isCalled: boolean
  calledAt?: Date | null
  calledBy?: Types.ObjectId | null
  notes?: string
  /** Name snapshots, filled in when the referenced account is deleted so history stays readable */
  servantName?: string
  calledByName?: string
}

export type OutreachAssignmentDocument = HydratedDocument<IOutreachAssignment>

const OutreachAssignmentSchema = new Schema<IOutreachAssignment>(
  {
    cycleId: { type: Schema.Types.ObjectId, ref: 'OutreachCycle', required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'OutreachRound', required: true, index: true },
    servantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    servanteeId: { type: Schema.Types.ObjectId, ref: 'Servantee', required: true, index: true },
    isCalled: { type: Boolean, default: false, index: true },
    calledAt: { type: Date, default: null },
    calledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, default: '' },
    servantName: { type: String, trim: true },
    calledByName: { type: String, trim: true },
  },
  { collection: 'outreach_assignments', timestamps: true }
)

// Ensure each servantee is only assigned once per cycle
OutreachAssignmentSchema.index({ cycleId: 1, servanteeId: 1 }, { unique: true })

export const OutreachAssignment =
  mongoose.models.OutreachAssignment ||
  mongoose.model<IOutreachAssignment>('OutreachAssignment', OutreachAssignmentSchema)
