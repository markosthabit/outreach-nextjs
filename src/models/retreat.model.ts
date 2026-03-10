import mongoose, { HydratedDocument, Schema, Types } from 'mongoose';

export interface IRetreat {
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
  attendees?: Types.ObjectId[];
  notes?: Types.ObjectId[];
}

export type RetreatDocument = HydratedDocument<IRetreat>;

const RetreatSchema = new Schema<IRetreat>(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    attendees: [{ type: Types.ObjectId, ref: 'Servantee', default: [] }],
    notes: [{ type: Types.ObjectId, ref: 'Note', default: [] }],
  },
  { collection: 'retreats', timestamps: true }
);

export const Retreat =
  mongoose.models.Retreat || mongoose.model<IRetreat>('Retreat', RetreatSchema);