import mongoose, { HydratedDocument, Schema } from 'mongoose';

export enum UserRole {
  ADMIN = 'Admin',
  SERVANT = 'Servant',
}

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  refreshTokenHash?: string;
}

export type UserDocument = HydratedDocument<IUser>;

const UserSchema = new Schema<IUser>(
  {
    name: { required: [true, 'Name is required'], type: String },
    email: {
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      type: String,
    },
    password: {
      required: [true, 'Password is required'],
      select: false,
      minlength: [8, 'Password must be at least 8 characters long'],
      type: String,
    },
    role: {
      type: String,
      enum: {
        values: [UserRole.ADMIN, UserRole.SERVANT],
        message: 'Role must be either Admin or Servant',
      },
      default: UserRole.SERVANT,
    },
    refreshTokenHash: { type: String, select: false, required: false },
  },
  { collection: 'users', timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);