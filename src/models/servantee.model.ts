import mongoose, { HydratedDocument, Schema, Types } from 'mongoose';

export interface IServantee {
  phone: string;
  name: string;
  birthDate?: Date;
  education?: string;
  year?: string;
  church?: string;
  retreatDates?: Date[];
  notes?: Types.ObjectId[];
  retreats?: Types.ObjectId[];
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

export type ServanteeDocument = HydratedDocument<IServantee>;

const ServanteeSchema = new Schema<IServantee>(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    birthDate: { type: Date },
    education: { type: String },
    year: { type: String },
    church: { type: String },
    retreatDates: { type: [Date] },
    notes: [{ type: Types.ObjectId, ref: 'Note' }],
    retreats: [{ type: Types.ObjectId, ref: 'Retreat', default: [] }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Types.ObjectId, ref: 'User', required: false },
    updatedBy: { type: Types.ObjectId, ref: 'User', required: false },
  },
  { collection: 'servantees', timestamps: true }
);

export const Servantee =
  mongoose.models.Servantee || mongoose.model<IServantee>('Servantee', ServanteeSchema);