CREATE TABLE `notification_templates` (
  `id` VARCHAR(191) NOT NULL,
  `organization_id` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `audience` VARCHAR(191) NOT NULL,
  `event_type` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NULL,
  `body` TEXT NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `nt_org_channel_audience_event_idx`(
    `organization_id`,
    `channel`,
    `audience`,
    `event_type`
  ),
  INDEX `nt_org_is_default_idx`(
    `organization_id`,
    `is_default`
  ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notification_templates`
  ADD CONSTRAINT `notification_templates_organization_id_fkey`
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
