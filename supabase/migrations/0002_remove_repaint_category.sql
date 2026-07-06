-- ---------------------------------------------------------------------------
-- Remove the unused 'repaint' expense category option
-- ---------------------------------------------------------------------------

alter table expenses drop constraint expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('repair', 'cleaning', 'tax', 'other'));
