CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT * FROM <%= events; %>
WHERE
  (
    (events.process_tx IS NULL)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;