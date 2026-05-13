-- Migration: Add 'notes' column to applications table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS notes TEXT;
