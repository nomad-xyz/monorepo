CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  send.token,
  sum(send.amount) AS sum
FROM
  <%= send;%>
GROUP BY
  send.token;