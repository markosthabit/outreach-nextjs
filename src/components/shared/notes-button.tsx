'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Pencil, Plus, StickyNote } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ConfirmDeleteDialog } from './delete-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Note {
  _id: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NotesButtonProps {
  entityId: string;
  entityType: 'servantee' | 'retreat'; // singular — used for body key
  /** Icon-only trigger, for dense table rows. */
  compact?: boolean;
}

// Maps entityType to its API path segment (plural) and body key (singular)
const ENTITY_MAP = {
  servantee: { path: 'servantees', bodyKey: 'servanteeId' },
  retreat:   { path: 'retreats',   bodyKey: 'retreatId'   },
} as const

export default function NotesButton({ entityId, entityType, compact = false }: NotesButtonProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin'; // deleting is admin-only (enforced by the API too)
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editedContent, setEditedContent] = useState('');

  const { path, bodyKey } = ENTITY_MAP[entityType]

  async function fetchNotes() {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ notes: Note[] }>(
        `/api/notes/${path}/${entityId}`
      );
      setNotes(res.notes ?? []);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) fetchNotes();
  }, [open]);

  async function handleCreate() {
    if (!newNote.trim()) return;
    try {
      await apiFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: newNote,
          [bodyKey]: entityId,
        }),
      });
      setNewNote('');
      fetchNotes();
    } catch (err) {
      console.error('Create note failed', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n._id !== id));
    } catch (err: any) {
      console.error('Delete note failed', err);
      toast.error(err?.message || 'معرفناش نمسح الملاحظة');
    }
  }

  async function handleUpdate() {
    if (!editingNote) return;
    try {
      await apiFetch(`/api/notes/${editingNote._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editedContent }),
      });
      setEditingNote(null);
      fetchNotes();
    } catch (err) {
      console.error('Update note failed', err);
    }
  }

  return (
    <>
      {compact ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground"
          title="ملاحظات"
          aria-label="ملاحظات"
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          ملاحظات
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>ملاحظات</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground animate-pulse">
              بنحمّل...
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  لسه مفيش ملاحظات
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note._id}
                    className="border rounded-lg p-3 flex items-start justify-between gap-2"
                  >
                    {editingNote?._id === note._id ? (
                      <div className="flex-1">
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button size="sm" onClick={handleUpdate}>احفظ</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingNote(null)}>
                            رجوع
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 text-right">
                          <p className="whitespace-pre-wrap">{note.content}</p>
                          {note.updatedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              آخر تعديل: {new Date(note.updatedAt).toLocaleDateString('ar-EG')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => { setEditingNote(note); setEditedContent(note.content) }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <ConfirmDeleteDialog
                              onConfirm={() => handleDelete(note._id)}
                              title="تمسح الملاحظة؟"
                              description="متأكد إنك عايز تمسح الملاحظة دي؟"
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 pt-3">
            <div className="flex gap-2">
              <Input
                placeholder="ضيف ملاحظة جديدة..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" /> ضيف
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}