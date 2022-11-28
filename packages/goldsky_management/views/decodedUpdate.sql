CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
update.vid,
update.block,
update.id,
update."timestamp",
update.transaction_hash,
update.block_number,
update.contract_id,
update.home_domain,
update.old_root,
update.new_root,
update.signature,
update._gs_chain,
update._gs_gid,
  CASE
    update._gs_chain
      WHEN 'avalanche' :: text THEN 1635148152
      WHEN 'mainnet' :: text THEN 6648936
      WHEN 'evmos' :: text THEN 1702260083
      WHEN 'milkomedac1' :: text THEN 25393
      WHEN 'moonbeam' :: text THEN 1650811245
      WHEN 'xdai' :: text THEN 2019844457
      ELSE 0
  END AS gs_chain_id
FROM
  <%= update;%>;