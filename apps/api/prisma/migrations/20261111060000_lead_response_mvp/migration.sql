ALTER TABLE `content_items` MODIFY `type` ENUM('SEO_ARTICLE', 'WEBSITE_REWRITE', 'FACEBOOK_POST', 'LINKEDIN_POST', 'REDDIT_RESPONSE', 'CAMPAIGN_IDEA', 'EMAIL_NEWSLETTER', 'SOCIAL_POST', 'LEAD_REPLY') NOT NULL;

CREATE TABLE `lead_opportunities` (
  `id` CHAR(36) NOT NULL, `business_id` CHAR(36) NOT NULL, `platform` VARCHAR(50) NOT NULL,
  `original_url` VARCHAR(2048) NOT NULL, `canonical_url` VARCHAR(2048) NOT NULL, `source_key_hash` CHAR(64) NOT NULL,
  `platform_post_id` VARCHAR(255) NULL, `community_name` VARCHAR(255) NULL, `post_text` LONGTEXT NOT NULL,
  `author_display_name` VARCHAR(255) NULL, `posted_at` DATETIME(3) NULL, `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `captured_by_id` CHAR(36) NOT NULL, `capture_method` VARCHAR(30) NOT NULL DEFAULT 'MANUAL', `source_version` INTEGER NOT NULL DEFAULT 1,
  `source_text_hash` CHAR(64) NOT NULL, `status` ENUM('NEW','QUALIFIED','DISMISSED','CLOSED') NOT NULL DEFAULT 'NEW',
  `relevance` ENUM('RELEVANT','UNCERTAIN','NOT_RELEVANT') NULL, `relevance_reason` TEXT NULL, `relevance_score` INTEGER NULL,
  `dismissal_reason` TEXT NULL, `version` INTEGER NOT NULL DEFAULT 1, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `lead_opportunities_business_id_status_captured_at_idx` (`business_id`,`status`,`captured_at`),
  UNIQUE INDEX `lead_opportunities_business_id_source_key_hash_key` (`business_id`,`source_key_hash`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_replies` (
  `id` CHAR(36) NOT NULL, `business_id` CHAR(36) NOT NULL, `lead_id` CHAR(36) NOT NULL, `content_item_id` CHAR(36) NOT NULL,
  `recommendation_id` CHAR(36) NOT NULL, `current_revision_id` CHAR(36) NULL, `active_approval_id` CHAR(36) NULL,
  `version` INTEGER NOT NULL DEFAULT 1, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `lead_replies_lead_id_key` (`lead_id`), UNIQUE INDEX `lead_replies_content_item_id_key` (`content_item_id`),
  UNIQUE INDEX `lead_replies_recommendation_id_key` (`recommendation_id`), UNIQUE INDEX `lead_replies_current_revision_id_key` (`current_revision_id`),
  UNIQUE INDEX `lead_replies_active_approval_id_key` (`active_approval_id`), INDEX `lead_replies_business_id_created_at_idx` (`business_id`,`created_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_reply_revisions` (
  `id` CHAR(36) NOT NULL, `reply_id` CHAR(36) NOT NULL, `revision_number` INTEGER NOT NULL, `body` LONGTEXT NOT NULL,
  `body_hash` CHAR(64) NOT NULL, `source_version` INTEGER NOT NULL, `source_text_hash` CHAR(64) NOT NULL,
  `posting_identity` VARCHAR(255) NOT NULL, `created_by_id` CHAR(36) NOT NULL, `ai_generated` BOOLEAN NOT NULL DEFAULT false,
  `model` VARCHAR(100) NULL, `prompt_version` VARCHAR(50) NOT NULL DEFAULT 'lead-reply-v1', `policy_version` INTEGER NOT NULL DEFAULT 1,
  `generation_metadata` JSON NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `lead_reply_revisions_reply_id_revision_number_key` (`reply_id`,`revision_number`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_reply_approvals` (
  `id` CHAR(36) NOT NULL, `reply_id` CHAR(36) NOT NULL, `revision_id` CHAR(36) NOT NULL,
  `decision` ENUM('APPROVED','REJECTED') NOT NULL, `actor_user_id` CHAR(36) NOT NULL, `decided_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reason` TEXT NULL, `source_text_hash` CHAR(64) NOT NULL, `posting_identity` VARCHAR(255) NOT NULL, `policy_version` INTEGER NOT NULL,
  `revoked_at` DATETIME(3) NULL, `revocation_reason` TEXT NULL,
  INDEX `lead_reply_approvals_reply_id_decided_at_idx` (`reply_id`,`decided_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_reply_publications` (
  `id` CHAR(36) NOT NULL, `business_id` CHAR(36) NOT NULL, `reply_id` CHAR(36) NOT NULL, `revision_id` CHAR(36) NOT NULL,
  `approval_id` CHAR(36) NULL, `method` VARCHAR(30) NOT NULL DEFAULT 'MANUAL', `actual_text` LONGTEXT NOT NULL,
  `actual_text_hash` CHAR(64) NOT NULL, `posting_identity` VARCHAR(255) NOT NULL, `response_url` VARCHAR(2048) NULL,
  `platform_response_id` VARCHAR(255) NULL, `published_at` DATETIME(3) NOT NULL, `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `recorded_by_id` CHAR(36) NOT NULL, `verification_status` ENUM('USER_ATTESTED','PLATFORM_CONFIRMED') NOT NULL DEFAULT 'USER_ATTESTED',
  `approval_compliance` ENUM('COMPLIANT','DEVIATED','UNAPPROVED') NOT NULL, `evidence_note` TEXT NULL, `idempotency_key` VARCHAR(100) NOT NULL,
  UNIQUE INDEX `lead_reply_publications_reply_id_key` (`reply_id`), UNIQUE INDEX `lead_reply_publications_approval_id_key` (`approval_id`),
  UNIQUE INDEX `lead_reply_publications_business_id_idempotency_key_key` (`business_id`,`idempotency_key`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `business_outreach_policies` (
  `id` CHAR(36) NOT NULL, `business_id` CHAR(36) NOT NULL, `version` INTEGER NOT NULL DEFAULT 1,
  `speaker_name` VARCHAR(100) NOT NULL DEFAULT '', `speaker_role` VARCHAR(150) NOT NULL DEFAULT '',
  `allow_business_name` BOOLEAN NOT NULL DEFAULT true, `allow_public_links` BOOLEAN NOT NULL DEFAULT false,
  `allowed_urls` JSON NOT NULL, `approved_claims` JSON NOT NULL, `cta_style` TEXT NOT NULL DEFAULT 'Helpful and low pressure',
  `excluded_topics` JSON NOT NULL, `max_reply_length` INTEGER NOT NULL DEFAULT 1200, `updated_by_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `business_outreach_policies_business_id_key` (`business_id`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `lead_opportunities` ADD CONSTRAINT `lead_opportunities_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_opportunities` ADD CONSTRAINT `lead_opportunities_captured_by_id_fkey` FOREIGN KEY (`captured_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_replies` ADD CONSTRAINT `lead_replies_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_replies` ADD CONSTRAINT `lead_replies_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead_opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_replies` ADD CONSTRAINT `lead_replies_content_item_id_fkey` FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_replies` ADD CONSTRAINT `lead_replies_recommendation_id_fkey` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_replies` ADD CONSTRAINT `lead_replies_current_revision_id_fkey` FOREIGN KEY (`current_revision_id`) REFERENCES `lead_reply_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `lead_replies` ADD CONSTRAINT `lead_replies_active_approval_id_fkey` FOREIGN KEY (`active_approval_id`) REFERENCES `lead_reply_approvals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `lead_reply_revisions` ADD CONSTRAINT `lead_reply_revisions_reply_id_fkey` FOREIGN KEY (`reply_id`) REFERENCES `lead_replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_reply_revisions` ADD CONSTRAINT `lead_reply_revisions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_reply_approvals` ADD CONSTRAINT `lead_reply_approvals_reply_id_fkey` FOREIGN KEY (`reply_id`) REFERENCES `lead_replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_reply_approvals` ADD CONSTRAINT `lead_reply_approvals_revision_id_fkey` FOREIGN KEY (`revision_id`) REFERENCES `lead_reply_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_reply_approvals` ADD CONSTRAINT `lead_reply_approvals_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_reply_publications` ADD CONSTRAINT `lead_reply_publications_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_reply_publications` ADD CONSTRAINT `lead_reply_publications_reply_id_fkey` FOREIGN KEY (`reply_id`) REFERENCES `lead_replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_reply_publications` ADD CONSTRAINT `lead_reply_publications_revision_id_fkey` FOREIGN KEY (`revision_id`) REFERENCES `lead_reply_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_reply_publications` ADD CONSTRAINT `lead_reply_publications_approval_id_fkey` FOREIGN KEY (`approval_id`) REFERENCES `lead_reply_approvals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `lead_reply_publications` ADD CONSTRAINT `lead_reply_publications_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `business_outreach_policies` ADD CONSTRAINT `business_outreach_policies_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `business_outreach_policies` ADD CONSTRAINT `business_outreach_policies_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
