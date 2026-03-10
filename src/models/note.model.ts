import mongoose, { HydratedDocument, Schema, Types } from 'mongoose';

export interface INote {
  content: string;
  servanteeId?: Types.ObjectId;
  retreatId?: Types.ObjectId;
}

export type NoteDocument = HydratedDocument<INote>;

const NoteSchema = new Schema<INote>(
  {
    content: { type: String, required: true, trim: true },
    servanteeId: { type: Types.ObjectId, ref: 'Servantee' },
    retreatId: { type: Types.ObjectId, ref: 'Retreat' },
  },
  { collection: 'notes', timestamps: true }
);


export const Note = mongoose.models.Note || mongoose.model<INote>('Note', NoteSchema);