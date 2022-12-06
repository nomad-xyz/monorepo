CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT 
origin_domain_id as origin, destination_domain_id as destination,
sum(case when _events.process_tx is null and _events.relay_tx is null and _events.update_tx is null then 1 else 0 end) as dispatched,
sum(case when _events.update_tx is not null and _events.process_tx is null and _events.relay_tx is null then 1 else 0 end) as updated,
sum(case when _events.relay_tx is not null and _events.process_tx is null then 1 else 0 end) as relayed,
sum(case when _events.process_tx is not null then 1 else 0 end) as processed
from <%= events; %> _events group by origin_domain_id, destination_domain_id;