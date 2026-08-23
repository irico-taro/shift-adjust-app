export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS staff (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#64748b',
  weekly_hours_min  REAL NOT NULL DEFAULT 0,
  weekly_hours_max  REAL NOT NULL DEFAULT 40,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lesson_type (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7c3aed',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staff_qualification (
  staff_id        TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  lesson_type_id  TEXT NOT NULL REFERENCES lesson_type(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, lesson_type_id)
);

CREATE TABLE IF NOT EXISTS weekly_template_slot (
  id              TEXT PRIMARY KEY,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  slot_type       TEXT NOT NULL CHECK (slot_type IN ('lesson','shift')),
  lesson_type_id  TEXT REFERENCES lesson_type(id) ON DELETE SET NULL,
  shift_label     TEXT,
  required_count  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS schedule_period (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  phase       TEXT NOT NULL CHECK (phase IN ('collecting','adjusting','confirmed'))
);

CREATE TABLE IF NOT EXISTS availability (
  staff_id        TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_id       TEXT NOT NULL REFERENCES schedule_period(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('ok','ng','conditional')),
  available_from  TEXT,
  available_to    TEXT,
  PRIMARY KEY (staff_id, period_id, date)
);

CREATE TABLE IF NOT EXISTS assignment (
  id         TEXT PRIMARY KEY,
  period_id  TEXT NOT NULL REFERENCES schedule_period(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  slot_id    TEXT NOT NULL REFERENCES weekly_template_slot(id) ON DELETE CASCADE,
  staff_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('draft','confirmed')),
  UNIQUE (period_id, date, slot_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_period ON assignment(period_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_period ON availability(period_id, date);

CREATE TABLE IF NOT EXISTS work_rule (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK (kind IN ('minInterval','forbiddenSequence','maxConsecutiveDays','weeklyHoursRange')),
  enabled               INTEGER NOT NULL DEFAULT 1,
  after_shift_label     TEXT,
  forbidden_next_label  TEXT,
  hours                 REAL,
  days                  INTEGER
);
`;
