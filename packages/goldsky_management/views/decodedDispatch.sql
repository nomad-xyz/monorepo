CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS WITH decoded AS (
  SELECT
    dispatch.id,
    dispatch."timestamp",
    dispatch.transaction_hash,
    dispatch.block_number,
    dispatch.contract_id,
    dispatch.message_hash,
    dispatch.leaf_index,
    dispatch.destination_and_nonce,
    dispatch.committed_root,
    dispatch.message,
    dispatch._gs_chain,
    (
      (
        ('x' :: text || "substring"(dispatch.message, 3, 8))
      ) :: bit(32)
    ) :: integer AS origin_domain_id,
    (
      '0x' :: text || ltrim(
        "substring"(dispatch.message, (3 + 8), 64),
        '0' :: text
      )
    ) AS sender_address,
    (
      (
        (
          'x' :: text || "substring"(dispatch.message, ((3 + 8) + 64), 8)
        )
      ) :: bit(32)
    ) :: integer AS nonce,
    (
      (
        (
          'x' :: text || "substring"(dispatch.message, (((3 + 8) + 64) + 8), 8)
        )
      ) :: bit(32)
    ) :: integer AS destination_domain_id,
    (
      '0x' :: text || ltrim(
        "substring"(dispatch.message, ((((3 + 8) + 64) + 8) + 8), 64),
        '0' :: text
      )
    ) AS recipient_address,
    "substring"(
      dispatch.message,
      (((((3 + 8) + 64) + 8) + 8) + 64)
    ) AS message_body,
    "substring"(
      dispatch.message,
      (((((3 + 8) + 64) + 8) + 8) + 64),
      72
    ) AS message__token_body,
    (
      (
        (
          'x' :: text || "substring"(
            dispatch.message,
            (((((3 + 8) + 64) + 8) + 8) + 64),
            8
          )
        )
      ) :: bit(32)
    ) :: bigint AS message__token__domain,
    "substring"(
      dispatch.message,
      ((((((3 + 8) + 64) + 8) + 8) + 64) + 8),
      64
    ) AS message__token__id,
    "substring"(
      dispatch.message,
      (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64),
      194
    ) AS action_body,
    "substring"(
      dispatch.message,
      (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64),
      2
    ) AS message__action__type,
    (
      '0x' :: text || ltrim(
        "substring"(
          dispatch.message,
          (
            (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
          ),
          64
        ),
        '0' :: text
      )
    ) AS message__action__to,
    (
      (
        (
          'x' :: text || ltrim(
            "substring"(
              dispatch.message,
              (
                (
                  (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
                ) + 64
              ),
              64
            ),
            '0' :: text
          )
        )
      ) :: bit(32)
    ) :: bigint AS message__action__amount,
    "substring"(
      dispatch.message,
      (
        (
          (
            (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
          ) + 64
        ) + 64
      ),
      64
    ) AS message__action__details_hash
  FROM
    <%= dispatch;%>
)

SELECT
  decoded.id,
  decoded."timestamp",
  decoded.transaction_hash,
  decoded.block_number,
  decoded.contract_id,
  decoded.message_hash,
  decoded.leaf_index,
  decoded.destination_and_nonce,
  decoded.committed_root,
  decoded.message,
  decoded._gs_chain,
  decoded.origin_domain_id,
  decoded.sender_address,
  decoded.nonce,
  decoded.destination_domain_id,
  decoded.recipient_address,
  decoded.message_body,
  decoded.message__token_body,
  decoded.message__token__domain,
  decoded.message__token__id,
  decoded.action_body,
  decoded.message__action__type,
  decoded.message__action__to,
  decoded.message__action__amount,
  decoded.message__action__details_hash,
  CASE
    length(decoded.message_body)
    WHEN (133 * 2) THEN 'TRANSFER' :: text
    ELSE 'OTHER' :: text
  END AS message_type,

  CASE
    decoded.origin_domain_id
    <% for (const domain of domains) { %>
      WHEN <%= domain.domain %> THEN '<%= domain.name %>' :: text
    <% } %>


    -- WHEN 6648936 THEN 'ethereum' :: text
    -- WHEN 1635148152 THEN 'avalanche' :: text
    -- WHEN 1702260083 THEN 'evmos' :: text
    -- WHEN 25393 THEN 'milkomedaC1' :: text
    -- WHEN 1650811245 THEN 'moonbeam' :: text
    -- WHEN 2019844457 THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS origin_domain_name,
  CASE
    decoded.destination_domain_id
    <% for (const domain of domains) { %>
      WHEN <%= domain.domain %> THEN '<%= domain.name %>' :: text
    <% } %>
    -- WHEN 6648936 THEN 'ethereum' :: text
    -- WHEN 1635148152 THEN 'avalanche' :: text
    -- WHEN 1702260083 THEN 'evmos' :: text
    -- WHEN 25393 THEN 'milkomedaC1' :: text
    -- WHEN 1650811245 THEN 'moonbeam' :: text
    -- WHEN 2019844457 THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS destination_domain_name,
  CASE
    decoded.message__token__domain

    <% for (const domain of domains) { %>
      WHEN '<%= domain.domain %>' :: bigint THEN '<%= domain.name %>' :: text
    <% } %>
    -- WHEN '6648936' :: bigint THEN 'ethereum' :: text
    -- WHEN '1635148152' :: bigint THEN 'avalanche' :: text
    -- WHEN '1702260083' :: bigint THEN 'evmos' :: text
    -- WHEN '25393' :: bigint THEN 'milkomedaC1' :: text
    -- WHEN '1650811245' :: bigint THEN 'moonbeam' :: text
    -- WHEN '2019844457' :: bigint THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS message__token__domain_name
FROM
  decoded;
