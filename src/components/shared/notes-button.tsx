'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ConfirmDeleteDialog } from './delete-dialog';

interface Note {
  _id: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NotesButtonProps {
  entityId: string;
  entityType: 'servantee' | 'retreat';
}

export default function NotesButton({ entityId, entityType }: NotesButtonProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editedContent, setEditedContent] = useState('');

  // --- Fetch Notes ---
  async function fetchNotes() {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await apiFetch<Note[]>(
        `/notes/${entityType}/${entityId}`,
      );
        setNotes(data);
        console.log("notes loaded!")
    } catch (err) {
        console.error('Failed to load notes', err);
        console.log(err)
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) fetchNotes();
  }, [open]);

  // --- Create Note ---
  async function handleCreate() {
    if (!newNote.trim()) return;
    try {
      await apiFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: newNote,
          [`${entityType}Id`]: entityId,
        }),
      });
      setNewNote('');
      fetchNotes();
    } catch (err) {
        console.error('Create note failed', err);
        console.log(JSON.stringify({
          content: newNote,
          [`${entityType}Id`]: entityId,
        }))
        console.log(err)
    }
  }

  // --- Delete Note ---
  async function handleDelete(id: string) {
    try {
      await apiFetch(`/notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
        console.log("id: ", id)
      console.error('Delete note failed', err);
    }
  }

  // --- Update Note ---
  async function handleUpdate() {
    if (!editingNote) return;
    try {
      await apiFetch(`/notes/${editingNote._id}`, {
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        ملاحظات
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ملاحظات</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground">جاري التحميل...</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-center text-muted-foreground">لا توجد ملاحظات بعد</p>
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
                          <Button size="sm" onClick={handleUpdate}>
                            حفظ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingNote(null)}
                          >
                            إلغاء
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
                            onClick={() => {
                              setEditingNote(note);
                              setEditedContent(note.content);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <ConfirmDeleteDialog
                                              onConfirm={() => handleDelete(note._id)}
                                              title="حذف ملحوظة"
                                              description="هل أنت متأكد أنك ترغب في حذف هذه الملحوظة؟ لن يمكنك استرجاع البيانات مرة أخرى."
                                              triggerLabel="حذف"
                                            />

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
                placeholder="أضف ملاحظة جديدة..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" /> إضافة
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
