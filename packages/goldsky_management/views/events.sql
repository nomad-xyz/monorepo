CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS (EVENTS SQL CODE)
FROM <%= decoded_dispatch;%>

