-- Submissions count once the submitter clicks the link in the confirmation email.
-- Only a SHA-256 hash of the emailed token is stored.
ALTER TABLE talk_proposals ADD COLUMN confirm_token_hash TEXT;
ALTER TABLE talk_proposals ADD COLUMN confirmed_at TEXT;
CREATE UNIQUE INDEX talk_proposals_confirm_token_hash ON talk_proposals (confirm_token_hash);

ALTER TABLE venue_offers ADD COLUMN confirm_token_hash TEXT;
ALTER TABLE venue_offers ADD COLUMN confirmed_at TEXT;
CREATE UNIQUE INDEX venue_offers_confirm_token_hash ON venue_offers (confirm_token_hash);
