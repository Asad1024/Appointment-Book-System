-- Waitlist enhancements (idempotent where possible)
SET @db := DATABASE();

-- preferred_start_utc
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND COLUMN_NAME = 'preferred_start_utc'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `waitlist` ADD COLUMN `preferred_start_utc` DATETIME(3) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- status
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND COLUMN_NAME = 'status'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `waitlist` ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT ''active''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- customer_id
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND COLUMN_NAME = 'customer_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `waitlist` ADD COLUMN `customer_id` VARCHAR(191) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- location_id
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND COLUMN_NAME = 'location_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `waitlist` ADD COLUMN `location_id` VARCHAR(191) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- indexes
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND INDEX_NAME = 'waitlist_service_id_preferred_date_status_idx'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX `waitlist_service_id_preferred_date_status_idx` ON `waitlist`(`service_id`, `preferred_date`, `status`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND INDEX_NAME = 'waitlist_customer_email_status_idx'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX `waitlist_customer_email_status_idx` ON `waitlist`(`customer_email`, `status`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- foreign keys
SET @fk_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND CONSTRAINT_NAME = 'waitlist_customer_id_fkey'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE `waitlist` ADD CONSTRAINT `waitlist_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'waitlist' AND CONSTRAINT_NAME = 'waitlist_location_id_fkey'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE `waitlist` ADD CONSTRAINT `waitlist_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- backfill status from notified_at
UPDATE `waitlist` SET `status` = 'notified' WHERE `notified_at` IS NOT NULL AND (`status` IS NULL OR `status` = 'active');
