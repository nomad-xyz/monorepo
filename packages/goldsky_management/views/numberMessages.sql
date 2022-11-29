CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  (ms.dispatched - ms.updated) AS dispatched,
  (ms.updated - ms.relayed) AS updated,
  (ms.relayed - ms.processed) AS relayed,
  ms.processed,
  ms.origin,
  ms.destination
FROM
  (
    SELECT
      events.origin_domain_id AS origin,
      events.destination_domain_id AS destination,
      count(*) AS dispatched,
      count(events.update_tx) AS updated,
      count(events.relay_tx) AS relayed,
      count(events.process_tx) AS processed
    FROM
      <%= events; %>
    GROUP BY
      events.origin_domain_id,
      events.destination_domain_id
  ) ms;