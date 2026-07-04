create or replace function public.mark_booking_completed(_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  owner_id uuid;
  prev_status booking_status;
begin
  select * into b from public.bookings where id = _booking_id for update;
  if not found then raise exception 'booking not found'; end if;

  select t.owner_id into owner_id from public.turfs t where t.id = b.turf_id;

  if b.user_id <> auth.uid() and coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid() then
    raise exception 'not allowed';
  end if;
  if b.end_at > now() then
    raise exception 'booking has not finished yet';
  end if;
  if b.status not in ('confirmed', 'pending') then
    return b;
  end if;

  prev_status := b.status;

  update public.bookings
     set status = 'completed'::booking_status, updated_at = now()
   where id = _booking_id
   returning * into b;

  begin
    insert into public.booking_status_events (booking_id, from_status, to_status, changed_by, note)
    values (b.id, prev_status, 'completed'::booking_status, auth.uid(), 'Auto-completed');
  exception when others then null; end;

  return b;
end;
$$;

revoke execute on function public.mark_booking_completed(uuid) from public, anon;
grant execute on function public.mark_booking_completed(uuid) to authenticated;