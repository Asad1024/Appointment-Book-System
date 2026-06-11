-- Waitlist: preferred time, status lifecycle, optional customer link
ALTER TABLE `waitlist`
  ADD COLUMN `preferred_start_utc` DATETIME(3) NULL,
  ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  ADD COLUMN `customer_id` VARCHAR(191) NULL,
  ADD COLUMN `location_id` VARCHAR(191) NULL;

CREATE INDEX `waitlist_service_id_preferred_date_status_idx` ON `waitlist`(`service_id`, `preferred_date`, `status`);
CREATE INDEX `waitlist_customer_email_status_idx` ON `waitlist`(`customer_email`, `status`);

ALTER TABLE `waitlist`
  ADD CONSTRAINT `waitlist_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `waitlist`
  ADD CONSTRAINT `waitlist_location_id_fkey`
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
