-- ========================================================================
-- ساحة التحدي (Challenge Arena) — D1 Schema Migration
-- Migration: 0001_arena_schema.sql
-- Description: إنشاء جداول ساحة التحدي بنمط آمن وقابل للتكرار دون المساس بالجداول الحالية
-- ========================================================================

-- 1. جدول جلسات اللعب (الجولات المكتملة أو الملغاة)
CREATE TABLE IF NOT EXISTS arena_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    student_name TEXT,
    class_id TEXT,
    course_key TEXT NOT NULL,
    mode TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 0,
    total_q INTEGER NOT NULL DEFAULT 0,
    correct_q INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- 2. جدول تفاصيل إجابات الطلاب على كل سؤال (للتقارير وتحليل الصعوبة)
CREATE TABLE IF NOT EXISTS arena_answers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id INTEGER,
    qid TEXT NOT NULL,
    lesson_id TEXT,
    is_correct INTEGER NOT NULL,
    chosen_idx INTEGER,
    time_taken_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- 3. جدول محفظة الذهب والنقاط للشخصية النشطة
CREATE TABLE IF NOT EXISTS arena_wallet (
    user_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    active_avatar TEXT NOT NULL DEFAULT 'falcon',
    updated_at INTEGER NOT NULL
);

-- 4. جدول مشتريات المتجر والعناصر المفتوحة (شخصيات / سمات)
CREATE TABLE IF NOT EXISTS arena_items (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'avatar',
    purchased_at INTEGER NOT NULL,
    UNIQUE(user_id, item_id)
);

-- 5. جدول حقائب الأسئلة المخصصة للمعلم (CSV أو إدخال يدوي)
CREATE TABLE IF NOT EXISTS arena_sets (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    course_key TEXT,
    questions_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ========================================================================
-- الفهارس لتحسين سرعة الاستعلامات والتقارير
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_arena_sessions_user ON arena_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arena_sessions_course ON arena_sessions(course_key, created_at);
CREATE INDEX IF NOT EXISTS idx_arena_answers_session ON arena_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_arena_answers_lesson ON arena_answers(lesson_id);
CREATE INDEX IF NOT EXISTS idx_arena_answers_user ON arena_answers(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arena_items_user ON arena_items(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_sets_user ON arena_sets(user_id, updated_at);
