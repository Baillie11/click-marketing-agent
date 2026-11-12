CREATE TABLE `lead_discovery_profiles` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `platforms` JSON NOT NULL,
  `search_terms` JSON NOT NULL,
  `intent_phrases` JSON NOT NULL,
  `excluded_terms` JSON NOT NULL,
  `locations` JSON NOT NULL,
  `frequency` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  `max_results` INTEGER NOT NULL DEFAULT 10,
  `last_run_at` DATETIME(3) NULL,
  `next_run_at` DATETIME(3) NULL,
  `updated_by_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `lead_discovery_profiles_business_id_key` (`business_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_discovery_runs` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  `discovered_count` INTEGER NOT NULL DEFAULT 0,
  `created_count` INTEGER NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  INDEX `lead_discovery_runs_business_id_started_at_idx` (`business_id`, `started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `lead_discovery_profiles` ADD CONSTRAINT `lead_discovery_profiles_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_discovery_profiles` ADD CONSTRAINT `lead_discovery_profiles_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_discovery_runs` ADD CONSTRAINT `lead_discovery_runs_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
