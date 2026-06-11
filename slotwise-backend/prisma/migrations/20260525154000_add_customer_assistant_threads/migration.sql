CREATE TABLE `customer_assistant_threads` (
  `id` VARCHAR(191) NOT NULL,
  `organization_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `page` VARCHAR(191) NOT NULL,
  `messages` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `customer_assistant_threads_user_id_updated_at_idx`(`user_id`, `updated_at`),
  UNIQUE INDEX `cat_org_user_page_uk`(`organization_id`, `user_id`, `page`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_assistant_threads`
  ADD CONSTRAINT `customer_assistant_threads_organization_id_fkey`
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_assistant_threads`
  ADD CONSTRAINT `customer_assistant_threads_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
