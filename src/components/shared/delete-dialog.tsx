'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteDialogProps {
  /** Called when user confirms delete */
  onConfirm: () => void
  /** Optional: Text shown in the delete button */
  triggerLabel?: string
  /** Optional: Dialog title */
  title?: string
  /** Optional: Dialog description */
  description?: string
  /** Optional: Customize button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary'
  /** Optional: Customize button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Optional: RTL mode toggle */
  rtl?: boolean
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  onConfirm,
  triggerLabel = 'حذف',
  title = 'تأكيد الحذف',
  description = 'هل أنت متأكد أنك ترغب في حذف هذا العنصر؟ لن يمكنك استرجاع البيانات مرة أخرى.',
  variant = 'destructive',
  size = 'sm',
  rtl = true,
}) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} type="button">
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent dir={rtl ? 'rtl' : 'ltr'} className={rtl ? 'text-right' : 'text-left'}>
        <AlertDialogHeader>
          <AlertDialogTitle className={rtl ? 'text-right' : 'text-left'}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className={rtl ? 'text-right' : 'text-left'}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
