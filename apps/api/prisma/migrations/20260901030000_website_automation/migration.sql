ALTER TABLE `websites`
  ADD COLUMN `automation_mode` ENUM('RECOMMEND_ONLY', 'APPROVAL_REQUIRED', 'AUTO_LOW_RISK') NOT NULL DEFAULT 'RECOMMEND_ONLY',
  ADD COLUMN `automation_rules` JSON NULL,
  ADD COLUMN `connection_provider` ENUM('NONE', 'WORDPRESS', 'SHOPIFY', 'CUSTOM') NOT NULL DEFAULT 'NONE',
  ADD COLUMN `connection_status` ENUM('DISCONNECTED', 'CONNECTED', 'ERROR') NOT NULL DEFAULT 'DISCONNECTED';

CREATE TABLE `website_changes` (
  `id` CHAR(36) NOT NULL,
  `website_id` CHAR(36) NOT NULL,
  `seo_issue_id` CHAR(36) NULL,
  `recommendation_id` CHAR(36) NULL,
  `target_url` VARCHAR(2048) NOT NULL,
  `target_field` VARCHAR(100) NOT NULL,
  `before_value` LONGTEXT NULL,
  `proposed_value` LONGTEXT NOT NULL,
  `applied_value` LONGTEXT NULL,
  `status` ENUM('PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VERIFIED', 'FAILED', 'REVERTED') NOT NULL DEFAULT 'PROPOSED',
  `approved_by_id` CHAR(36) NULL,
  `approved_at` DATETIME(3) NULL,
  `applied_at` DATETIME(3) NULL,
  `verified_at` DATETIME(3) NULL,
  `failure_reason` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `website_changes_website_id_status_idx` (`website_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `website_changes_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
