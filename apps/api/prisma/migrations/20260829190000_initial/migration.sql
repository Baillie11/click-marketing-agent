-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `businesses` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(170) NOT NULL,
    `website_url` VARCHAR(2048) NOT NULL,
    `description` TEXT NOT NULL,
    `industry` VARCHAR(150) NOT NULL,
    `location` VARCHAR(250) NOT NULL,
    `target_audience` TEXT NOT NULL,
    `products_services` TEXT NOT NULL,
    `primary_goal` TEXT NOT NULL,
    `secondary_goals` JSON NOT NULL,
    `brand_tone` TEXT NOT NULL,
    `keywords` JSON NOT NULL,
    `main_cta` VARCHAR(500) NOT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `businesses_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_members` (
    `user_id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'EDITOR', 'VIEWER') NOT NULL DEFAULT 'OWNER',

    PRIMARY KEY (`user_id`, `business_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brand_voices` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `tone` TEXT NOT NULL,
    `formality` INTEGER NOT NULL DEFAULT 3,
    `humour_level` INTEGER NOT NULL DEFAULT 2,
    `preferred_phrases` JSON NOT NULL,
    `prohibited_phrases` JSON NOT NULL,
    `target_customer` TEXT NOT NULL,
    `cta_style` TEXT NOT NULL,
    `spelling_style` VARCHAR(100) NOT NULL DEFAULT 'Australian English',
    `instructions` TEXT NOT NULL,

    UNIQUE INDEX `brand_voices_business_id_key`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `websites` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `base_url` VARCHAR(2048) NOT NULL,
    `last_crawled_at` DATETIME(3) NULL,
    `health_score` INTEGER NULL,

    UNIQUE INDEX `websites_business_id_key`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_crawls` (
    `id` CHAR(36) NOT NULL,
    `website_id` CHAR(36) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `pages_found` INTEGER NOT NULL DEFAULT 0,
    `pages_crawled` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_pages` (
    `id` CHAR(36) NOT NULL,
    `website_id` CHAR(36) NOT NULL,
    `crawl_id` CHAR(36) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `status_code` INTEGER NOT NULL,
    `title` VARCHAR(512) NULL,
    `meta_description` TEXT NULL,
    `canonical_url` VARCHAR(2048) NULL,
    `h1` JSON NOT NULL,
    `h2` JSON NOT NULL,
    `h3` JSON NOT NULL,
    `visible_text` LONGTEXT NOT NULL,
    `word_count` INTEGER NOT NULL,
    `images` JSON NOT NULL,
    `open_graph` JSON NOT NULL,
    `fetched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `website_pages_website_id_idx`(`website_id`),
    UNIQUE INDEX `website_pages_crawl_id_url_key`(`crawl_id`, `url`(500)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_links` (
    `id` CHAR(36) NOT NULL,
    `from_page_id` CHAR(36) NOT NULL,
    `target_url` VARCHAR(2048) NOT NULL,
    `is_internal` BOOLEAN NOT NULL,
    `status_code` INTEGER NULL,
    `anchor_text` TEXT NOT NULL,

    INDEX `website_links_target_url_idx`(`target_url`(500)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `seo_issues` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `page_id` CHAR(36) NULL,
    `severity` ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'OPPORTUNITY') NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `explanation` TEXT NOT NULL,
    `suggested_action` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DISMISSED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `fingerprint` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `seo_issues_fingerprint_key`(`fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendations` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `page_id` CHAR(36) NULL,
    `source` VARCHAR(50) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `severity` ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'OPPORTUNITY') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `current_value` LONGTEXT NULL,
    `proposed_value` LONGTEXT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DISMISSED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_items` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `page_id` CHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `type` ENUM('SEO_ARTICLE', 'WEBSITE_REWRITE', 'FACEBOOK_POST', 'LINKEDIN_POST', 'REDDIT_RESPONSE', 'CAMPAIGN_IDEA', 'EMAIL_NEWSLETTER', 'SOCIAL_POST') NOT NULL,
    `status` ENUM('IDEA', 'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `body` LONGTEXT NOT NULL,
    `metadata` JSON NULL,
    `tags` JSON NOT NULL,
    `notes` TEXT NOT NULL,
    `ai_generated` BOOLEAN NOT NULL DEFAULT false,
    `scheduled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_items_business_id_status_type_idx`(`business_id`, `status`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketing_plans` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketing_plan_items` (
    `id` CHAR(36) NOT NULL,
    `plan_id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `rationale` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DISMISSED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `scheduled_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NULL,
    `user_id` CHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NULL,
    `entity_id` CHAR(36) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_business_id_created_at_idx`(`business_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_members` ADD CONSTRAINT `business_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_members` ADD CONSTRAINT `business_members_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brand_voices` ADD CONSTRAINT `brand_voices_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `websites` ADD CONSTRAINT `websites_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_crawls` ADD CONSTRAINT `website_crawls_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_pages` ADD CONSTRAINT `website_pages_website_id_fkey` FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_pages` ADD CONSTRAINT `website_pages_crawl_id_fkey` FOREIGN KEY (`crawl_id`) REFERENCES `website_crawls`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_links` ADD CONSTRAINT `website_links_from_page_id_fkey` FOREIGN KEY (`from_page_id`) REFERENCES `website_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seo_issues` ADD CONSTRAINT `seo_issues_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seo_issues` ADD CONSTRAINT `seo_issues_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `website_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `website_pages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_items` ADD CONSTRAINT `content_items_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_items` ADD CONSTRAINT `content_items_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `website_pages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_plans` ADD CONSTRAINT `marketing_plans_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_plan_items` ADD CONSTRAINT `marketing_plan_items_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `marketing_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
