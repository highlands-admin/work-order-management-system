-- Remove the facility-preference feature: the Profile page no longer offers
-- it, so this table (added in 20260706120000_user_preferences.sql) is now
-- unused. Dropping the table cascades the policies and trigger defined on it.

drop table if exists public.user_preferences cascade;
