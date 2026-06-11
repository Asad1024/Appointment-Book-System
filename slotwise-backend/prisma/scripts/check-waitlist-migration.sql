SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'waitlist'
  AND COLUMN_NAME IN ('preferred_start_utc', 'status', 'customer_id', 'location_id');
