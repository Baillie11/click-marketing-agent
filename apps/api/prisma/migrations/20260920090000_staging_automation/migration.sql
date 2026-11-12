ALTER TABLE `websites`
  ADD COLUMN `staging_base_url` VARCHAR(2048) NULL,
  ADD COLUMN `connection_base_url` VARCHAR(2048) NULL,
  ADD COLUMN `connection_target` ENUM('LIVE', 'STAGING') NOT NULL DEFAULT 'LIVE';

ALTER TABLE `website_changes`
  ADD COLUMN `target_environment` ENUM('LIVE', 'STAGING') NOT NULL DEFAULT 'LIVE',
  ADD COLUMN `execution_target_url` VARCHAR(2048) NULL;
