-- Preserve recurrence per property: an identically named task in a different
-- property (or owned by another household) must never suppress the next task.
create or replace function public.homepilot_roll_recurring_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  unit text;
  step int;
  next_due date;
begin
  if old.status is distinct from 'done' and new.status='done' and coalesce(new.recurrence,'{}'::jsonb) <> '{}'::jsonb then
    unit := new.recurrence->>'unit';
    step := coalesce((new.recurrence->>'interval')::int,1);
    next_due := coalesce(new.due_at,current_date);
    if unit='week' then next_due := next_due + (7*step);
    elsif unit='month' then next_due := (next_due + make_interval(months=>step))::date;
    elsif unit='day' then next_due := next_due + step;
    else return new;
    end if;

    insert into public.tasks(property_id,equipment_id,title,category,due_at,status,priority,diy,source_note,instructions,materials,created_by,recurrence)
    select new.property_id,new.equipment_id,new.title,new.category,next_due,'todo',new.priority,new.diy,new.source_note,new.instructions,new.materials,new.created_by,new.recurrence
    where not exists(select 1 from public.tasks t
      where t.property_id = new.property_id
        and t.equipment_id is not distinct from new.equipment_id
        and t.title=new.title and t.status<>'done');
  end if;
  return new;
end;
$function$;
