-- Backup your database before running these commands.

DROP TABLE IF EXISTS actuator_commands;
DROP TABLE IF EXISTS actuator_states;
DROP TABLE IF EXISTS actuator_logs;
DROP TABLE IF EXISTS actuators;

ALTER TABLE device_commands DROP COLUMN IF EXISTS actuator;
ALTER TABLE commands DROP COLUMN IF EXISTS actuator;
