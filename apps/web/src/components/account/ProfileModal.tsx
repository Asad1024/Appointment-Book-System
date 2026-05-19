'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { apiAuth, type AuthUser } from '@/lib/api';
import { profileSchema, type ProfileForm } from '@/lib/auth-schemas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/shared/PasswordField';
import { PasswordStrength } from '@/components/shared/PasswordStrength';

type ProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
  onUpdated: (user: AuthUser) => void;
};

export function ProfileModal({ open, onOpenChange, user, onUpdated }: ProfileModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, currentPassword: '', newPassword: '' },
  });

  const newPassword = watch('newPassword') ?? '';

  useEffect(() => {
    if (open) {
      reset({ name: user.name, currentPassword: '', newPassword: '' });
    }
  }, [open, user.name, reset]);

  async function onSubmit(values: ProfileForm) {
    try {
      const body: Record<string, string> = { name: values.name };
      if (values.newPassword) {
        body.currentPassword = values.currentPassword ?? '';
        body.newPassword = values.newPassword;
      }
      const updated = await apiAuth<AuthUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onUpdated(updated);
      toast.success('Profile updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update profile');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your name or password.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <p className="text-xs text-text-muted">{user.email}</p>
          <PasswordField
            id="profile-current"
            label="Current password"
            autoComplete="current-password"
            {...register('currentPassword')}
            error={errors.currentPassword?.message}
          />
          <div>
            <PasswordField
              id="profile-new"
              label="New password"
              autoComplete="new-password"
              {...register('newPassword')}
              error={errors.newPassword?.message}
            />
            {newPassword ? <PasswordStrength password={newPassword} /> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
