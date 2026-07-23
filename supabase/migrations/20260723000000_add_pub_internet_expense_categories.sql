-- Add 'pub' (public utility bills) and 'internet' expense categories

alter table expenses drop constraint expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('repair', 'cleaning', 'tax', 'pub', 'internet', 'other'));
