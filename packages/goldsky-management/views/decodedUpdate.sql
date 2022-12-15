CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
update_1.*,
  CASE
    update_1._gs_chain
    <% for (const domain of domains) { %>
      WHEN '<%= domain.name %>' :: text THEN '<%= domain.domain %>'
    <% } %>
      ELSE 0
  END AS gs_chain_id
FROM
  <%= update;%> update_1;