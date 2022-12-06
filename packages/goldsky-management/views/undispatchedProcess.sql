CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  process.vid,
  process.id,
  process."timestamp",
  process.transaction_hash,
  process.block_number,
  process.contract_id,
  process.message_hash,
  process.success,
  process.return_data,
  process._gs_chain,
  process._gs_gid
FROM
  <%= process; %>
WHERE
  (
    NOT (
      process.message_hash IN (
        SELECT
          dispatch.message_hash
        FROM
          <%= dispatch; %>
      )
    )
  );