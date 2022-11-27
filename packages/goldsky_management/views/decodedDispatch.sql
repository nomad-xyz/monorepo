CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS (DECODED DISPATCH SQL CODE)
FROM <%= dispatch;%>

