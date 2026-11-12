CREATE TABLE `contacts` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `business_name` VARCHAR(150) NOT NULL,
  `contact_name` VARCHAR(150) NOT NULL,
  `contact_number` VARCHAR(50) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `contacts_business_id_business_name_idx` (`business_id`, `business_name`),
  INDEX `contacts_business_id_contact_name_idx` (`business_id`, `contact_name`),
  PRIMARY KEY (`id`),
  CONSTRAINT `contacts_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
