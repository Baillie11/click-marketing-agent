ALTER TABLE `websites`
  ADD COLUMN `connection_username` VARCHAR(255) NULL,
  ADD COLUMN `connection_secret` TEXT NULL,
  ADD COLUMN `connection_verified_at` DATETIME(3) NULL,
  ADD COLUMN `connection_error` TEXT NULL;
