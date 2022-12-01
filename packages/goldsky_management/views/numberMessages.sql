CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
WITH _events AS (
  SELECT
    dispatch_tx,
    update_tx,
    relay_tx,
    process_tx,
    origin_domain_id as origin,
    destination_domain_id as destination
  from
    <%= events; %>
),
dispatched as (
  SELECT
    origin,
    destination,
    count(*) as dispatched
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NULL)
      AND (relay_tx IS NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination
),
updated as (
  SELECT
    origin,
    destination,
    count(*) as updated
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination

),
relayed as (
  SELECT
    origin,
    destination,
    count(*) as relayed
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NOT NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination

),
processed as (
  SELECT
    origin,
    destination,
    count(*) as processed
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NOT NULL)
      AND (process_tx IS NOT NULL)
    )
  group by
    origin,
    destination

),
_full AS (
  SELECT
    dispatched.origin,
    dispatched.destination,
    dispatched.dispatched,
    updated.updated,
    relayed.relayed,
    processed.processed
  from
    dispatched
    LEFT JOIN updated ON dispatched.origin = updated.origin AND dispatched.destination = updated.destination
    LEFT JOIN relayed ON dispatched.origin = relayed.origin AND dispatched.destination = relayed.destination
    LEFT JOIN processed ON dispatched.origin = processed.origin AND dispatched.destination = processed.destination
)
SELECT
  _full.origin,
  _full.destination,
  _full.dispatched,
  _full.updated,
  _full.relayed,
  _full.processed
from
  _full;