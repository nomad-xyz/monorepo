CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT * FROM <%= events; %>
WHERE
  (
    (events.process_tx IS NULL)
    AND (events.dispatched_at > (1659139261) :: numeric)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;