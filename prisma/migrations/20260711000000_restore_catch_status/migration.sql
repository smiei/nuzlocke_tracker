-- Data repair: the old "mark as dead" flipped linked encounters to KILLED,
-- overwriting the catch-time status. Encounters only ever join a SoulLink
-- when saved as CAUGHT, so every linked KILLED row was provably flipped by
-- markDead - restore it. Death now lives solely on SoulLink.status.
UPDATE "Encounter" SET "status" = 'CAUGHT'
WHERE "soulLinkId" IS NOT NULL AND "status" = 'KILLED';
