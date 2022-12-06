CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  events.id,
  events.dispatched_at AS sent_at,
  events.origin_domain_id,
  events.destination_domain_id,
  (events.message__token__domain) :: integer AS token_domain,
  events.message__token__id AS token_id,
  events.message__action__amount AS amount,
  events.dispatch_tx,
  events.relay_tx,
  events.update_tx,
  events.process_tx
FROM
  <%= events; %>
WHERE
  (
    (events.process_tx IS NULL)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;