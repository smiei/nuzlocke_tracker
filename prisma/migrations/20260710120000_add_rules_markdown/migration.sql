-- Run.rulesMarkdown: raw markdown for the per-run Rules tab. Existing runs get
-- '' - the app falls back to the built-in default ruleset when it's empty.
ALTER TABLE "Run" ADD COLUMN "rulesMarkdown" TEXT NOT NULL DEFAULT '';
