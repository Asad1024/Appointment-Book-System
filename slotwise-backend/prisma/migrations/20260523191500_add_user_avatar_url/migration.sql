-- Add persistent avatar URL for users so Google profile photos remain visible
-- even when the same account signs in with email/password later.
ALTER TABLE `users`
  ADD COLUMN `avatar_url` VARCHAR(1024) NULL;
