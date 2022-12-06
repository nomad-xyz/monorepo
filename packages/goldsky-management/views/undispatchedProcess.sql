CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT * FROM <%= process; %>
WHERE NOT (
  process.message_hash IN (
    SELECT
      dispatch.message_hash
    FROM
      <%= dispatch; %>
  )
);