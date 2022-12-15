CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  receive.token,
  sum(receive.amount) AS sum
FROM <%= receive; %>
  JOIN <%= events; %> ON ((receive.transaction_hash = events.process_tx))
GROUP BY
  receive.token;