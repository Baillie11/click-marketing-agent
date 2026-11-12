ALTER TABLE `contacts`
  ADD COLUMN `normalized_email` VARCHAR(255) NOT NULL AFTER `email`,
  ADD COLUMN `source` VARCHAR(50) NULL,
  ADD COLUMN `source_id` VARCHAR(255) NULL,
  ADD COLUMN `suppressed_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `contacts_business_id_normalized_email_key` ON `contacts`(`business_id`, `normalized_email`);
CREATE UNIQUE INDEX `contacts_business_id_source_id_key` ON `contacts`(`business_id`, `source_id`);

CREATE TABLE `integration_tokens` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `last_used_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `integration_tokens_token_hash_key` (`token_hash`),
  INDEX `integration_tokens_business_id_revoked_at_idx` (`business_id`, `revoked_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `integration_tokens_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
