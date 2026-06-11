SET @add_users_provider_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `provider_id` VARCHAR(191) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'provider_id'
);
PREPARE stmt FROM @add_users_provider_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_team_invites_provider_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `team_invites` ADD COLUMN `provider_id` VARCHAR(191) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'team_invites'
    AND column_name = 'provider_id'
);
PREPARE stmt FROM @add_team_invites_provider_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_users_provider_id_unique = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE UNIQUE INDEX `users_provider_id_key` ON `users`(`provider_id`)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'users_provider_id_key'
);
PREPARE stmt FROM @add_users_provider_id_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_users_provider_id_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD CONSTRAINT `users_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT 1'
  )
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'users'
    AND constraint_name = 'users_provider_id_fkey'
);
PREPARE stmt FROM @add_users_provider_id_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
