CREATE TABLE `billing_history` (
  `id` VARCHAR(191) NOT NULL,
  `organization_id` VARCHAR(191) NOT NULL,
  `event_type` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `number` VARCHAR(191) NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'AED',
  `amount_paid_minor` INTEGER NOT NULL DEFAULT 0,
  `amount_due_minor` INTEGER NOT NULL DEFAULT 0,
  `external_id` VARCHAR(191) NULL,
  `hosted_invoice_url` TEXT NULL,
  `invoice_pdf_url` TEXT NULL,
  `receipt_url` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `billing_history_organization_id_created_at_idx`(`organization_id`, `created_at`),
  UNIQUE INDEX `bh_org_event_external_uk`(`organization_id`, `event_type`, `external_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `billing_history`
  ADD CONSTRAINT `billing_history_organization_id_fkey`
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
