CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
update_1.vid,
update_1.block,
update_1.id,
update_1."timestamp",
update_1.transaction_hash,
update_1.contract_id,
update_1.home_domain,
update_1.old_root,
update_1.new_root,
update_1.signature,
update_1._gs_chain,
update_1._gs_gid,
  CASE
    update_1._gs_chain
    <% for (const domain of domains) { %>
      WHEN '<%= domain.name %>' :: text THEN '<%= domain.domain %>'
    <% } %>
      -- WHEN 'avalanche' :: text THEN 1635148152
      -- WHEN 'mainnet' :: text THEN 6648936
      -- WHEN 'evmos' :: text THEN 1702260083
      -- WHEN 'milkomedac1' :: text THEN 25393
      -- WHEN 'moonbeam' :: text THEN 1650811245
      -- WHEN 'xdai' :: text THEN 2019844457
      ELSE 0
  END AS gs_chain_id
FROM
  <%= update;%> update_1;