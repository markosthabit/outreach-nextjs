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
import { cn } from '@/lib/utils';

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
  /** Whether notes already exist (from the list API) — shows a dot on the trigger. */
  hasNotes?: boolean;
  /** Shown in the dialog title and the trigger's tooltip. */
  entityName?: string;
  /** Icon-only trigger style: borderless (tables) or outlined (cards). */
  iconVariant?: 'ghost' | 'outline';
  /** Extra classes for the trigger button. */
  className?: string;
}

// Maps entityType to its API path segment (plural) and body key (singular)
const ENTITY_MAP = {
  servantee: { path: 'servantees', bodyKey: 'servanteeId' },
  retreat:   { path: 'retreats',   bodyKey: 'retreatId'   },
} as const

export default function NotesButton({
  entityId,
  entityType,
  compact = false,
  hasNotes = false,
  entityName,
  iconVariant = 'ghost',
  className,
}: NotesButtonProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin'; // deleting is admin-only (enforced by the API too)
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editedContent, setEditedContent] = useState('');
  // Once the notes have been loaded here, that is fresher than the list's flag
  const [loadedHasNotes, setLoadedHasNotes] = useState<boolean | null>(null);
  const showIndicator = loadedHasNotes ?? hasNotes;
  const label = entityName ? `ملاحظات ${entityName}` : 'ملاحظات';
  const triggerTitle = showIndicator ? `${label} (فيه ملاحظات مكتوبة)` : label;

  const { path, bodyKey } = ENTITY_MAP[entityType]

  async function fetchNotes() {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ notes: Note[] }>(
        `/api/notes/${path}/${entityId}`
      );
      setNotes(res.notes ?? []);
      setLoadedHasNotes((res.notes ?? []).length > 0);
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
      const remaining = notes.filter((n) => n._id !== id);
      setNotes(remaining);
      setLoadedHasNotes(remaining.length > 0);
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
          variant={iconVariant}
          size={iconVariant === 'outline' ? 'icon' : 'icon-sm'}
          onClick={() => setOpen(true)}
          className={cn(
            'relative',
            showIndicator
              ? 'text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'
              : 'text-muted-foreground hover:text-foreground',
            showIndicator && iconVariant === 'outline' && 'border-amber-500/40',
            className
          )}
          title={triggerTitle}
          aria-label={triggerTitle}
        >
          <StickyNote className="h-4 w-4" />
          {showIndicator && <NotesDot />}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn('relative gap-1.5', showIndicator && 'border-amber-500/40', className)}
          title={triggerTitle}
        >
          <StickyNote
            className={cn('h-3.5 w-3.5', showIndicator ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}
          />
          ملاحظات
          {showIndicator && <NotesDot />}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
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

/** The "there are notes here" dot on the corner of the trigger. */
function NotesDot() {
  return (
    <span
      aria-hidden
      className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-background"
    />
  );
}
