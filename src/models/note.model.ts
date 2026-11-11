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
    // Notes are always looked up by the record they belong to
    servanteeId: { type: Types.ObjectId, ref: 'Servantee', index: true },
    retreatId: { type: Types.ObjectId, ref: 'Retreat', index: true },
  },
  { collection: 'notes', timestamps: true }
);


export const Note = mongoose.models.Note || mongoose.model<INote>('Note', NoteSchema);