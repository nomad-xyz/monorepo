CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  send_tokens.token,
  (send_tokens.sum - valid_receive_token_amts.sum) AS affected_amount
FROM <%= send_tokens; %>
  JOIN <%= valid_receive_token_amts; %> ON (
    (send_tokens.token = valid_receive_token_amts.token)
);