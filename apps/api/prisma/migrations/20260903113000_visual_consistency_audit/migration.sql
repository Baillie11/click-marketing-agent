CREATE TABLE `visual_audits` (
  `id` CHAR(36) NOT NULL,
  `website_id` CHAR(36) NOT NULL,
  `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `pages_audited` INTEGER NOT NULL DEFAULT 0,
  `result` JSON NULL,
  `error` TEXT NULL,
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `visual_audits_website_id_created_at_idx` (`website_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `visual_audits_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
